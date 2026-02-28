import { randomBytes } from "crypto";
import mongoose, { ClientSession } from "mongoose";
import { Booking, BookingDocument } from "../models/Booking";
import { BookingSlotLock } from "../models/BookingSlotLock";
import { Coach } from "../models/Coach";
import { User } from "../models/User";
import { Venue, VenueDocument } from "../models/Venue";
import { sendBookingConfirmationEmail } from "../utils/email";
import { getBookingExpirationTime } from "../utils/timer";

/**
 * Booking State Machine:
 * CONFIRMED -> IN_PROGRESS -> COMPLETED
 * CONFIRMED -> CANCELLED
 * CONFIRMED -> NO_SHOW
 */

export interface InitiateBookingPayload {
  userId: string;
  venueId?: string;
  coachId?: string;
  playerLocation?: {
    type: "Point";
    coordinates: [number, number];
  };
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  dependentId?: string;
}

export interface InitiateBookingResponse {
  booking: BookingDocument;
}

const TIME_FORMAT_REGEX = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const CHECK_IN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const MAX_TRANSACTION_RETRIES = 3;

interface BookingCreatePayload {
  userId: string;
  venueId?: string;
  coachId?: string;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalAmount: number;
  serviceFee: number;
  taxAmount: number;
  checkInCode: string;
  participantName: string;
  participantId: mongoose.Types.ObjectId;
  participantAge?: number;
}

const generateRandomCheckInCode = (): string => {
  const bytes = randomBytes(6);
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    const byte = bytes[index] ?? 0;
    code += CHECK_IN_CODE_CHARS[byte % CHECK_IN_CODE_CHARS.length];
  }

  return code;
};

const generateUniqueCheckInCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateRandomCheckInCode();
    const exists = await Booking.exists({ checkInCode: code });
    if (!exists) {
      return code;
    }
  }

  throw new Error("Unable to generate secure check-in code");
};

const normalizeTimeToHHmm = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(TIME_FORMAT_REGEX);
  if (!match) {
    throw new Error("Time must be in HH:mm format");
  }

  const rawHour = match[1] ?? "0";
  const minutes = match[2] ?? "00";
  const hour = String(parseInt(rawHour, 10)).padStart(2, "0");
  return `${hour}:${minutes}`;
};

const combineDateAndTime = (date: Date, time: string): Date => {
  const [hourPart, minutePart] = time.split(":");
  const hour = parseInt(hourPart || "0", 10);
  const minute = parseInt(minutePart || "0", 10);

  const slotDateTime = new Date(date);
  slotDateTime.setHours(hour, minute, 0, 0);

  return slotDateTime;
};

const toDayRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const getDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const hasErrorLabel = (error: unknown, label: string): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const possibleError = error as { hasErrorLabel?: (value: string) => boolean };
  return typeof possibleError.hasErrorLabel === "function"
    ? possibleError.hasErrorLabel(label)
    : false;
};

const isRetryableTransactionError = (error: unknown): boolean => {
  return (
    hasErrorLabel(error, "TransientTransactionError") ||
    hasErrorLabel(error, "UnknownTransactionCommitResult")
  );
};

const hasConflictingVenueBooking = async (
  venueId: string,
  date: Date,
  startTime: string,
  endTime: string,
  session?: ClientSession,
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const query = Booking.findOne({
    venueId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });

  if (session) {
    query.session(session);
  }

  const conflict = await query;
  return Boolean(conflict);
};

const hasConflictingCoachBooking = async (
  coachId: string,
  date: Date,
  startTime: string,
  endTime: string,
  session?: ClientSession,
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const query = Booking.findOne({
    coachId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });

  if (session) {
    query.session(session);
  }

  const conflict = await query;
  return Boolean(conflict);
};

const acquireResourceDayLock = async (
  resourceType: "VENUE_DAY" | "COACH_DAY",
  resourceId: string,
  date: Date,
  session: ClientSession,
): Promise<void> => {
  await BookingSlotLock.findOneAndUpdate(
    {
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      dateKey: getDateKey(date),
    },
    {
      $inc: { version: 1 },
      $set: { lastLockedAt: new Date() },
    },
    {
      upsert: true,
      new: true,
      session,
      setDefaultsOnInsert: true,
    },
  );
};

const createBookingAtomically = async (
  payload: BookingCreatePayload,
): Promise<BookingDocument> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    const session = await mongoose.startSession();

    try {
      let createdBooking: BookingDocument | null = null;

      await session.withTransaction(async () => {
        if (payload.venueId) {
          await acquireResourceDayLock(
            "VENUE_DAY",
            payload.venueId,
            payload.date,
            session,
          );

          const hasVenueConflict = await hasConflictingVenueBooking(
            payload.venueId,
            payload.date,
            payload.startTime,
            payload.endTime,
            session,
          );

          if (hasVenueConflict) {
            throw new Error(
              "Selected time slot is already booked for this venue",
            );
          }
        }

        if (payload.coachId) {
          await acquireResourceDayLock(
            "COACH_DAY",
            payload.coachId,
            payload.date,
            session,
          );

          const hasCoachConflict = await hasConflictingCoachBooking(
            payload.coachId,
            payload.date,
            payload.startTime,
            payload.endTime,
            session,
          );

          if (hasCoachConflict) {
            throw new Error(
              "Coach is not available for the selected time slot",
            );
          }
        }

        const booking = new Booking({
          userId: payload.userId,
          ...(payload.venueId ? { venueId: payload.venueId } : {}),
          ...(payload.coachId ? { coachId: payload.coachId } : {}),
          sport: payload.sport,
          date: payload.date,
          startTime: payload.startTime,
          endTime: payload.endTime,
          totalAmount: payload.totalAmount,
          serviceFee: payload.serviceFee,
          taxAmount: payload.taxAmount,
          status: "CONFIRMED",
          checkInCode: payload.checkInCode,
          expiresAt: getBookingExpirationTime(),
          participantName: payload.participantName,
          participantId: payload.participantId,
          ...(payload.participantAge !== undefined
            ? { participantAge: payload.participantAge }
            : {}),
        });

        await booking.save({ session });
        createdBooking = booking;
      });

      if (!createdBooking) {
        throw new Error("Failed to create booking");
      }

      return createdBooking;
    } catch (error) {
      lastError = error;
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_RETRIES
      ) {
        throw error;
      }
    } finally {
      await session.endSession();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to create booking after multiple retries");
};

const toRadians = (value: number): number => (value * Math.PI) / 180;

const calculateDistanceKm = (
  from: [number, number],
  to: [number, number],
): number => {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;

  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const earthRadiusKm = 6371;

  return earthRadiusKm * arc;
};

/**
 * Check if a time slot is available for a venue.
 * Use `createBookingAtomically` for race-safe booking creation.
 */
export const isSlotAvailable = async (
  venueId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> => {
  const hasConflict = await hasConflictingVenueBooking(
    venueId,
    date,
    startTime,
    endTime,
  );
  return !hasConflict;
};

/**
 * Initiate a new booking
 * This creates the booking in CONFIRMED status
 */
export const initiateBooking = async (
  payload: InitiateBookingPayload,
): Promise<InitiateBookingResponse> => {
  try {
    const normalizedStartTime = normalizeTimeToHHmm(payload.startTime);
    const normalizedEndTime = normalizeTimeToHHmm(payload.endTime);

    const requestedStartAt = combineDateAndTime(
      payload.date,
      normalizedStartTime,
    );
    const requestedEndAt = combineDateAndTime(payload.date, normalizedEndTime);
    const now = new Date();

    if (requestedEndAt <= requestedStartAt) {
      throw new Error("End time must be after start time");
    }

    if (requestedStartAt <= now) {
      throw new Error("Cannot book a slot in the past");
    }

    // Fetch user for participant information
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Determine participant details
    let participantName = user.name;
    let participantId: any = user._id;
    let participantAge: number | undefined = undefined;

    if (payload.dependentId) {
      // Booking is for a dependent (child)
      const dependent = user.dependents.find(
        (d) => d._id?.toString() === payload.dependentId,
      );
      if (!dependent) {
        throw new Error("Dependent not found");
      }
      participantName = dependent.name;
      participantId = dependent._id;
      // Calculate age from DOB
      const ageInMs = Date.now() - dependent.dob.getTime();
      participantAge = Math.floor(ageInMs / (1000 * 60 * 60 * 24 * 365.25));
    } else {
      // Booking is for the parent/user themselves
      participantId = user._id;
    }

    let venue: VenueDocument | null = null;

    if (payload.venueId) {
      venue = await Venue.findById(payload.venueId).populate("ownerId");
      if (!venue) {
        throw new Error("Venue not found");
      }

      const venueAvailable = await isSlotAvailable(
        payload.venueId,
        payload.date,
        normalizedStartTime,
        normalizedEndTime,
      );

      if (!venueAvailable) {
        throw new Error("Selected time slot is already booked for this venue");
      }

      if (!payload.sport || !venue.sports.includes(payload.sport)) {
        throw new Error("Selected sport is not available at this venue");
      }
    }

    // Calculate venue price (supports fractional hours)
    const startParts = normalizedStartTime.split(":");
    const endParts = normalizedEndTime.split(":");
    const startHour = parseInt(startParts[0] || "0", 10);
    const startMin = parseInt(startParts[1] || "0", 10);
    const endHour = parseInt(endParts[0] || "0", 10);
    const endMin = parseInt(endParts[1] || "0", 10);

    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    const totalMinutes = endTotalMinutes - startTotalMinutes;
    const hours = totalMinutes / 60; // Supports 0.5, 0.75, etc.
    let venuePrice = 0;
    if (venue) {
      const sportPrice = venue.sportPricing?.[payload.sport];
      const basePrice =
        typeof sportPrice === "number" && sportPrice >= 0
          ? sportPrice
          : venue.pricePerHour;
      if (basePrice <= 0) {
        throw new Error("Venue pricing is not configured for this sport");
      }
      venuePrice = Math.round(hours * basePrice * 100) / 100;
    }

    let coachPrice = 0;

    // If coach is requested, validate and calculate coach price
    if (payload.coachId) {
      const coach = await Coach.findById(payload.coachId).populate("userId");
      if (!coach) {
        throw new Error("Coach not found");
      }

      if (!payload.venueId && !payload.playerLocation) {
        throw new Error("Player location is required for coach booking");
      }

      if (
        (coach.serviceMode === "FREELANCE" || coach.serviceMode === "HYBRID") &&
        payload.playerLocation
      ) {
        const coachBaseCoordinates = coach.baseLocation?.coordinates;
        if (!coachBaseCoordinates || coachBaseCoordinates.length !== 2) {
          throw new Error("Coach service location is not configured");
        }

        const distanceKm = calculateDistanceKm(
          coachBaseCoordinates,
          payload.playerLocation.coordinates,
        );
        const serviceRadiusKm = coach.serviceRadiusKm || 10;

        if (distanceKm > serviceRadiusKm) {
          throw new Error(
            `Coach is out of range. This coach serves up to ${serviceRadiusKm} km from their base location.`,
          );
        }
      }

      if (
        venue &&
        coach.serviceMode !== "OWN_VENUE" &&
        !venue.allowExternalCoaches
      ) {
        throw new Error("This venue does not allow external coaches");
      }

      // Check coach availability (imported from CoachService logic)
      const coachAvailable = await checkCoachAvailabilityForBooking(
        payload.coachId,
        payload.date,
        normalizedStartTime,
        normalizedEndTime,
      );

      if (!coachAvailable) {
        throw new Error("Coach is not available for the selected time slot");
      }

      const coachSportRate =
        payload.sport && typeof coach.sportPricing?.[payload.sport] === "number"
          ? coach.sportPricing[payload.sport]
          : undefined;
      const effectiveCoachRate =
        typeof coachSportRate === "number" && coachSportRate > 0
          ? coachSportRate
          : coach.hourlyRate;

      coachPrice = hours * effectiveCoachRate;
    }

    const subtotal = venuePrice + coachPrice;
    const serviceFee = Math.round(subtotal * 0.02);
    const taxAmount = Math.round(subtotal * 0.05);
    const totalAmount = Math.max(0, subtotal + serviceFee + taxAmount);

    const checkInCode = await generateUniqueCheckInCode();

    const bookingPayload: BookingCreatePayload = {
      userId: payload.userId,
      ...(payload.venueId ? { venueId: payload.venueId } : {}),
      ...(payload.coachId ? { coachId: payload.coachId } : {}),
      sport: payload.sport,
      date: payload.date,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      totalAmount,
      serviceFee,
      taxAmount,
      checkInCode,
      participantName,
      participantId,
      ...(participantAge !== undefined ? { participantAge } : {}),
    };

    const booking =
      payload.venueId || payload.coachId
        ? await createBookingAtomically(bookingPayload)
        : await Booking.create({
            userId: bookingPayload.userId,
            ...(bookingPayload.venueId
              ? { venueId: bookingPayload.venueId }
              : {}),
            ...(bookingPayload.coachId
              ? { coachId: bookingPayload.coachId }
              : {}),
            sport: bookingPayload.sport,
            date: bookingPayload.date,
            startTime: bookingPayload.startTime,
            endTime: bookingPayload.endTime,
            totalAmount: bookingPayload.totalAmount,
            serviceFee: bookingPayload.serviceFee,
            taxAmount: bookingPayload.taxAmount,
            status: "CONFIRMED",
            checkInCode: bookingPayload.checkInCode,
            expiresAt: getBookingExpirationTime(),
            participantName: bookingPayload.participantName,
            participantId: bookingPayload.participantId,
            ...(bookingPayload.participantAge !== undefined
              ? { participantAge: bookingPayload.participantAge }
              : {}),
          });

    return {
      booking,
    };
  } catch (error) {
    throw new Error(
      `Failed to initiate booking: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Get all bookings for a user
 */
/**
 * Get all bookings for a user
 */
export const getUserBookings = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;
  const query = { userId };

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .select("+checkInCode")
    .populate("venueId coachId")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get all bookings for a venue (for venue owners)
 */
export const getVenueBookings = async (
  venueId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const query = {
    venueId,
    status: { $in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
  };
  const skip = (page - 1) * limit;

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate("userId coachId")
    .sort({ date: 1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get bookings for a venue on a specific date (optimized for availability check)
 */
export const getVenueBookingsForDate = async (
  venueId: string,
  date: Date,
): Promise<BookingDocument[]> => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return Booking.find({
    venueId,
    date: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
  }).select("startTime endTime");
};

/**
 * Get all bookings for a venue lister (across all their venues)
 */
export const getVenueListerBookings = async (
  ownerId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  // Find all venues owned by this user
  const venues = await Venue.find({ ownerId });
  const venueIds = venues.map((v) => v._id);

  const query = {
    venueId: { $in: venueIds },
    status: { $in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] },
  };
  const skip = (page - 1) * limit;

  // Find all bookings for these venues
  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate("userId venueId coachId")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Cancel a booking
 */
export const cancelBooking = async (
  bookingId: string,
): Promise<BookingDocument | null> => {
  return Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    },
    {
      $set: { status: "CANCELLED" },
    },
    { new: true },
  );
};

export const checkInBookingByCode = async (
  checkInCode: string,
  requesterUserId: string,
  requesterRole: string,
): Promise<BookingDocument> => {
  const normalizedCode = checkInCode.trim().toUpperCase();

  const booking = await Booking.findOne({ checkInCode: normalizedCode });

  if (!booking) {
    throw new Error("Invalid check-in code");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error(`Cannot check-in. Booking status is ${booking.status}`);
  }

  if (requesterRole !== "ADMIN") {
    const venue = await Venue.findById(booking.venueId).select("ownerId");
    if (!venue || venue.ownerId?.toString() !== requesterUserId) {
      throw new Error("Unauthorized to check in this booking");
    }
  }

  const now = new Date();
  const bookingDateTime = new Date(booking.date);
  const timeParts = booking.startTime.split(":").map(Number);
  const startHour = timeParts[0];
  const startMin = timeParts[1];

  if (
    startHour === undefined ||
    startMin === undefined ||
    isNaN(startHour) ||
    isNaN(startMin)
  ) {
    throw new Error("Invalid booking time format");
  }

  bookingDateTime.setHours(startHour, startMin, 0, 0);

  const checkInWindow = new Date(bookingDateTime.getTime() - 15 * 60 * 1000);
  if (now < checkInWindow) {
    throw new Error("Cannot check-in before the scheduled time");
  }

  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: "CONFIRMED",
    },
    {
      $set: { status: "IN_PROGRESS" },
    },
    { new: true },
  );

  if (!updatedBooking) {
    throw new Error("Cannot check-in. Booking status changed, please retry");
  }

  return updatedBooking;
};

/**
 * Check coach availability (kept synchronized with CoachService.checkCoachAvailability)
 * Duplicated to avoid circular dependency between services
 */
const checkCoachAvailabilityForBooking = async (
  coachId: string,
  date: Date,
  startTime: string,
  endTime: string,
): Promise<boolean> => {
  const coach = await Coach.findById(coachId);
  if (!coach) return false;
  const dayOfWeek = date.getDay();
  const dayAvailability = coach.availability.find(
    (a) => a.dayOfWeek === dayOfWeek,
  );
  if (!dayAvailability) return false;
  if (
    startTime < dayAvailability.startTime ||
    endTime > dayAvailability.endTime
  ) {
    return false;
  }
  // Only active bookings block slots: CONFIRMED, IN_PROGRESS
  const existingBooking = await Booking.findOne({
    coachId,
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    },
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });
  return !existingBooking;
};

/**
 * Confirm mock payment success and send booking confirmation email once
 */
export const confirmMockPaymentSuccess = async (
  bookingId: string,
  userId: string,
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId).select("+checkInCode");

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.userId.toString() !== userId) {
    throw new Error("Unauthorized to confirm this booking");
  }

  if (booking.status === "CANCELLED") {
    throw new Error("Cannot confirm payment for a cancelled booking");
  }

  await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      userId,
      status: { $ne: "CANCELLED" },
      paymentConfirmedAt: { $exists: false },
    },
    {
      $set: { paymentConfirmedAt: new Date() },
    },
  );

  const emailClaimedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      userId,
      status: { $ne: "CANCELLED" },
      confirmationEmailSentAt: { $exists: false },
    },
    {
      $set: { confirmationEmailSentAt: new Date() },
    },
    { new: true },
  ).select("+checkInCode");

  if (emailClaimedBooking) {
    const user = await User.findById(booking.userId).select("name email");
    const venue = await Venue.findById(booking.venueId).select("name");

    if (user?.email) {
      await sendBookingConfirmationEmail({
        name: user.name,
        email: user.email,
        venueName: venue?.name || "Venue",
        sport: emailClaimedBooking.sport,
        date: emailClaimedBooking.date,
        startTime: emailClaimedBooking.startTime,
        endTime: emailClaimedBooking.endTime,
        totalAmount: emailClaimedBooking.totalAmount,
        ...(emailClaimedBooking.checkInCode && {
          checkInCode: emailClaimedBooking.checkInCode,
        }),
      });
    }
  }

  const updatedBooking =
    await Booking.findById(bookingId).select("+checkInCode");
  if (!updatedBooking) {
    throw new Error("Booking not found");
  }

  return updatedBooking;
};

export const updatePaymentStatus = async (
  bookingId: string,
  payerUserId: string,
  status: "PAID" | "PENDING" | "FAILED",
  session?: ClientSession,
): Promise<BookingDocument> => {
  const bookingQuery = Booking.findById(bookingId);
  if (session) {
    bookingQuery.session(session);
  }

  const booking = await bookingQuery;

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.payments && booking.payments.length > 0) {
    booking.payments = booking.payments.map((payment) => {
      if (payment.userId.toString() !== payerUserId) {
        return payment;
      }

      return {
        ...payment,
        status,
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      };
    });
  }

  if (
    status === "PAID" &&
    (!booking.payments.length ||
      booking.payments.every((payment) => payment.status === "PAID"))
  ) {
    booking.paymentConfirmedAt = new Date();
  }

  if (session) {
    await booking.save({ session });
  } else {
    await booking.save();
  }
  return booking;
};

// Legacy function for backward compatibility
export const createBooking = initiateBooking;
