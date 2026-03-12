import { randomBytes } from "crypto";
import mongoose, { ClientSession } from "mongoose";
import { Booking, BookingDocument } from "../models/Booking";
import { BookingSlotLock } from "../models/BookingSlotLock";
import { Coach } from "../models/Coach";
import { User } from "../models/User";
import { Venue, VenueDocument } from "../models/Venue";
import {
  sendBookingConfirmationEmail,
  sendBookingInvitationEmail,
} from "../utils/email";
import { getBookingExpirationTime } from "../utils/timer";
import { validatePromoCode, applyPromoCode } from "./PromoCodeService";
import { isWithinOpeningHours } from "../utils/openingHours";
import friendService from "./FriendService";
import BookingInvitation from "../models/BookingInvitation";
import {
  BookingWaitlist,
  BookingWaitlistDocument,
} from "../models/BookingWaitlist";
import { calculateGroupPaymentSplits } from "../utils/payment";
import { generateHourlySlots } from "../utils/booking";
import { NotificationService } from "./NotificationService";
import { ScheduledNotificationService } from "./ScheduledNotificationService";

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
  promoCode?: string;
}

export interface CreateBookingWaitlistPayload {
  userId: string;
  venueId?: string;
  coachId?: string;
  sport: string;
  date: Date;
  startTime: string;
  endTime: string;
  alternateSlots?: string[];
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
  promoCode?: string;
  discountAmount?: number;
  checkInCode: string;
  participantName: string;
  participantId: mongoose.Types.ObjectId;
  participantAge?: number;
  organizerId: mongoose.Types.ObjectId;
}

const generateRandomCheckInCode = (): string => {
  const bytes = randomBytes(8); // Increased from 6 to 8 for better security
  let code = "";

  for (let index = 0; index < 8; index += 1) {
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
          ...(payload.promoCode ? { promoCode: payload.promoCode } : {}),
          ...(payload.discountAmount
            ? { discountAmount: payload.discountAmount }
            : {}),
          status: "CONFIRMED",
          checkInCode: payload.checkInCode,
          // No expiration for confirmed bookings - they're already paid/confirmed
          participantName: payload.participantName,
          participantId: payload.participantId,
          ...(payload.participantAge !== undefined
            ? { participantAge: payload.participantAge }
            : {}),
          organizerId: payload.organizerId,
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

export const validatePromoCodeForUser = async (
  code: string,
  userId: string,
  subtotal: number,
  hasCoach: boolean,
): Promise<{ isValid: boolean; discountAmount: number; message?: string }> => {
  return validatePromoCode(code, userId, subtotal, hasCoach);
};

export const getAlternateVenueSlots = async (
  venueId: string,
  date: Date,
  preferredStartTime: string,
  preferredEndTime: string,
  limit: number = 4,
): Promise<string[]> => {
  const available = await getVenueBookingsForDate(venueId, date);
  const requestedDurationMinutes = Math.max(
    30,
    ((): number => {
      const [startHour = 0, startMinute = 0] = preferredStartTime
        .split(":")
        .map(Number);
      const [endHour = 0, endMinute = 0] = preferredEndTime
        .split(":")
        .map(Number);
      return endHour * 60 + endMinute - (startHour * 60 + startMinute);
    })(),
  );

  const booked = available.map((entry) => ({
    startTime: entry.startTime,
    endTime: entry.endTime,
  }));
  const allSlots = generateHourlySlots(6, 23);

  const canFit = (start: string): boolean => {
    const [h = 0, m = 0] = start.split(":").map(Number);
    const endMinutes = h * 60 + m + requestedDurationMinutes;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;
    const candidateEnd = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

    return !booked.some((slot) => {
      return (
        (start >= slot.startTime && start < slot.endTime) ||
        (candidateEnd > slot.startTime && candidateEnd <= slot.endTime) ||
        (start <= slot.startTime && candidateEnd >= slot.endTime)
      );
    });
  };

  const preferredIndex = allSlots.findIndex(
    (slot) => slot === preferredStartTime,
  );
  const sorted = allSlots
    .map((slot, index) => ({
      slot,
      distance: preferredIndex >= 0 ? Math.abs(index - preferredIndex) : index,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.slot);

  return sorted.filter((slot) => canFit(slot)).slice(0, Math.max(1, limit));
};

export const createBookingWaitlistEntry = async (
  payload: CreateBookingWaitlistPayload,
): Promise<BookingWaitlistDocument> => {
  const waitlist = await BookingWaitlist.findOneAndUpdate(
    {
      userId: payload.userId,
      ...(payload.venueId ? { venueId: payload.venueId } : {}),
      ...(payload.coachId ? { coachId: payload.coachId } : {}),
      date: payload.date,
      startTime: payload.startTime,
      status: "ACTIVE",
    },
    {
      $set: {
        userId: payload.userId,
        ...(payload.venueId ? { venueId: payload.venueId } : {}),
        ...(payload.coachId ? { coachId: payload.coachId } : {}),
        sport: payload.sport,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        alternateSlots: payload.alternateSlots || [],
        status: "ACTIVE",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return waitlist;
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

      // Validate dependent's date of birth
      if (!dependent.dob || isNaN(dependent.dob.getTime())) {
        throw new Error("Invalid date of birth for dependent");
      }

      participantName = dependent.name;
      participantId = dependent._id;

      // Calculate age from DOB with proper validation
      const now = new Date();
      const birthDate = new Date(dependent.dob);

      // Check if DOB is in the future
      if (birthDate > now) {
        throw new Error("Date of birth cannot be in the future");
      }

      // Calculate age in years
      let age = now.getFullYear() - birthDate.getFullYear();
      const monthDiff = now.getMonth() - birthDate.getMonth();
      const dayDiff = now.getDate() - birthDate.getDate();

      // Adjust age if birthday hasn't occurred this year
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }

      participantAge = age;

      // Validate minimum age (must be at least 3 years old)
      if (participantAge < 3) {
        throw new Error("Participant must be at least 3 years old to book");
      }

      // Validate maximum age for dependents (must be under 18)
      if (participantAge >= 18) {
        throw new Error(
          "Dependents must be under 18 years old. Please book as an adult.",
        );
      }
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

      // Validate booking falls within venue opening hours
      if (venue.openingHours) {
        const hoursCheck = isWithinOpeningHours(
          payload.date,
          normalizedStartTime,
          normalizedEndTime,
          venue.openingHours,
        );

        if (!hoursCheck.isValid) {
          throw new Error(
            hoursCheck.message ||
              "Booking time is outside venue operating hours",
          );
        }
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
    let discountAmount = 0;
    let validPromoCode: string | undefined = undefined;

    // Validate and apply promo code if provided
    if (payload.promoCode) {
      const promoValidation = await validatePromoCode(
        payload.promoCode,
        payload.userId,
        subtotal,
        Boolean(payload.coachId),
      );

      if (!promoValidation.isValid) {
        throw new Error(promoValidation.message || "Invalid promo code");
      }

      discountAmount = promoValidation.discountAmount;
      validPromoCode = payload.promoCode.toUpperCase();
    }

    const totalAmount = Math.max(
      0,
      subtotal + serviceFee + taxAmount - discountAmount,
    );

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
      ...(validPromoCode ? { promoCode: validPromoCode } : {}),
      ...(discountAmount > 0 ? { discountAmount } : {}),
      checkInCode,
      participantName,
      participantId,
      ...(participantAge !== undefined ? { participantAge } : {}),
      organizerId: new mongoose.Types.ObjectId(payload.userId),
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
            ...(bookingPayload.promoCode
              ? { promoCode: bookingPayload.promoCode }
              : {}),
            ...(bookingPayload.discountAmount
              ? { discountAmount: bookingPayload.discountAmount }
              : {}),
            status: "CONFIRMED",
            checkInCode: bookingPayload.checkInCode,
            // No expiration for confirmed bookings - they're already paid/confirmed
            participantName: bookingPayload.participantName,
            participantId: bookingPayload.participantId,
            ...(bookingPayload.participantAge !== undefined
              ? { participantAge: bookingPayload.participantAge }
              : {}),
            organizerId: bookingPayload.organizerId,
          });

    // Record promo code usage after successful booking
    if (validPromoCode && discountAmount > 0) {
      await applyPromoCode(
        validPromoCode,
        payload.userId,
        booking._id.toString(),
        discountAmount,
      );
    }

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
/**
 * Cancel booking with time-based refund policy
 *
 * Refund Policy:
 * - > 48 hours before booking: 100% refund
 * - 24-48 hours before: 50% refund
 * - < 24 hours before: 0% refund (no refund)
 * - After booking start: 0% refund
 */
export const cancelBooking = async (
  bookingId: string,
  cancellationReason?: string,
): Promise<{
  booking: BookingDocument | null;
  refundAmount: number;
  refundPercentage: number;
}> => {
  const booking = await Booking.findOne({
    _id: bookingId,
    status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
  });

  if (!booking) {
    throw new Error("Booking not found or already cancelled");
  }

  // Calculate booking start time
  const [hours, minutes] = booking.startTime.split(":").map(Number);
  const bookingStartTime = new Date(booking.date);
  bookingStartTime.setHours(hours || 0, minutes || 0, 0, 0);

  const now = new Date();
  const hoursUntilBooking =
    (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Determine refund percentage based on cancellation policy
  let refundPercentage = 0;
  if (hoursUntilBooking > 48) {
    refundPercentage = 100; // Full refund
  } else if (hoursUntilBooking > 24) {
    refundPercentage = 50; // Half refund
  } else {
    refundPercentage = 0; // No refund
  }

  const refundAmount = Math.round(
    (booking.totalAmount * refundPercentage) / 100,
  );

  // Update booking status
  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: cancellationReason || "Cancelled by user",
        refundAmount,
        refundStatus: refundAmount > 0 ? "PENDING" : undefined,
      },
    },
    { new: true },
  );

  // Send cancellation notifications to all participants
  if (updatedBooking) {
    const venue = await Venue.findById(updatedBooking.venueId);

    if (venue) {
      // Get all participant user IDs (organizer + accepted participants)
      const participantIds = [
        updatedBooking.organizerId.toString(),
        ...updatedBooking.participants
          .filter((p) => p.status === "ACCEPTED")
          .map((p) => p.userId.toString()),
      ];

      // Send notification to each participant
      for (const participantId of participantIds) {
        NotificationService.send({
          userId: participantId,
          type: "BOOKING_CANCELLED",
          title: "Booking Cancelled",
          message: `Your booking for ${updatedBooking.sport} at ${venue.name} has been cancelled. ${refundPercentage > 0 ? `You will receive a ${refundPercentage}% refund.` : "No refund available."}`,
          data: {
            bookingId: updatedBooking._id.toString(),
            venueName: venue.name,
            sport: updatedBooking.sport,
            date: updatedBooking.date.toISOString(),
            startTime: updatedBooking.startTime,
            endTime: updatedBooking.endTime,
            cancellationReason: cancellationReason || "Cancelled by user",
            refundAmount,
            refundPercentage,
          },
        }).catch((err: Error) =>
          console.error(
            `Failed to send booking cancellation notification to ${participantId}:`,
            err,
          ),
        );

        NotificationService.send({
          userId: participantId,
          type: "BOOKING_STATUS_UPDATED",
          title: "Booking status changed",
          message: `Your booking is now CANCELLED for ${updatedBooking.sport}.`,
          data: {
            bookingId: updatedBooking._id.toString(),
            status: "CANCELLED",
            date: updatedBooking.date.toISOString(),
            startTime: updatedBooking.startTime,
            endTime: updatedBooking.endTime,
          },
        }).catch(() => {});

        // Send refund notification if refund is available
        if (refundAmount > 0) {
          NotificationService.send({
            userId: participantId,
            type: "PAYMENT_REFUND",
            title: "Refund Initiated",
            message: `A ${refundPercentage}% refund of ₹${refundAmount} has been initiated for your cancelled booking at ${venue.name}.`,
            data: {
              bookingId: updatedBooking._id.toString(),
              venueName: venue.name,
              sport: updatedBooking.sport,
              refundAmount,
              refundPercentage,
              cancellationReason: cancellationReason || "Cancelled by user",
            },
          }).catch((err: Error) =>
            console.error(
              `Failed to send refund notification to ${participantId}:`,
              err,
            ),
          );
        }
      }
    }

    // Cancel all pending reminders for this booking
    ScheduledNotificationService.cancelBookingReminders(
      updatedBooking._id,
    ).catch((err: Error) =>
      console.error(
        `Failed to cancel booking reminders for ${updatedBooking._id}:`,
        err,
      ),
    );
  }

  return {
    booking: updatedBooking,
    refundAmount,
    refundPercentage,
  };
};

export const checkInBookingByCode = async (
  checkInCode: string,
  requesterUserId: string,
  requesterRole: string,
): Promise<BookingDocument> => {
  const normalizedCode = checkInCode.trim().toUpperCase();

  const booking = await Booking.findOne({ checkInCode: normalizedCode }).select(
    "+checkInCode",
  );

  if (!booking) {
    throw new Error("Invalid check-in code");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error(`Cannot check-in. Booking status is ${booking.status}`);
  }

  // Verify authorization
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

  // Check-in window: 15 minutes before start time
  const checkInWindow = new Date(bookingDateTime.getTime() - 15 * 60 * 1000);
  if (now < checkInWindow) {
    throw new Error(
      "Check-in not yet available. You can check in 15 minutes before the booking starts.",
    );
  }

  // Check-in code expiration: 24 hours after booking end time
  const endTimeParts = booking.endTime.split(":").map(Number);
  const endHour = endTimeParts[0];
  const endMin = endTimeParts[1];
  const bookingEndTime = new Date(booking.date);
  bookingEndTime.setHours(endHour || 0, endMin || 0, 0, 0);
  const codeExpiryTime = new Date(
    bookingEndTime.getTime() + 24 * 60 * 60 * 1000,
  );

  if (now > codeExpiryTime) {
    throw new Error(
      "Check-in code has expired. This booking is no longer active.",
    );
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

  NotificationService.send({
    userId: updatedBooking.userId.toString(),
    type: "BOOKING_STATUS_UPDATED",
    title: "Booking checked in",
    message: `Your booking is now IN_PROGRESS for ${updatedBooking.sport}.`,
    data: {
      bookingId: updatedBooking._id.toString(),
      status: "IN_PROGRESS",
      date: updatedBooking.date.toISOString(),
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
    },
  }).catch(() => {});

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

  // Send payment confirmation notification
  const venue = await Venue.findById(updatedBooking.venueId).select("name");
  NotificationService.send({
    userId: userId,
    type: "PAYMENT_CONFIRMED",
    title: "Payment Confirmed",
    message: `Your payment for ${updatedBooking.sport} at ${venue?.name || "the venue"} has been confirmed!`,
    data: {
      bookingId: updatedBooking._id.toString(),
      venueName: venue?.name || "Venue",
      sport: updatedBooking.sport,
      date: updatedBooking.date.toISOString(),
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
      totalAmount: updatedBooking.totalAmount,
    },
  }).catch((err: Error) =>
    console.error(
      `Failed to send payment confirmation notification to ${userId}:`,
      err,
    ),
  );

  NotificationService.send({
    userId: userId,
    type: "BOOKING_CONFIRMED",
    title: "Booking confirmed",
    message: `Your booking for ${updatedBooking.sport} is confirmed.`,
    data: {
      bookingId: updatedBooking._id.toString(),
      status: updatedBooking.status,
      date: updatedBooking.date.toISOString(),
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
    },
  }).catch(() => {});

  // Create booking reminders
  const user = await User.findById(userId).select(
    "reminderPreferences notificationPreferences",
  );
  if (user && user.reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: updatedBooking._id,
        userId: updatedBooking.userId,
        bookingDate: updatedBooking.date,
        startTime: updatedBooking.startTime,
        endTime: updatedBooking.endTime,
        sport: updatedBooking.sport,
        venueName: venue?.name,
        coachName: undefined, // TODO: Add coach name when implementing coach bookings
      },
      user.reminderPreferences.bookingReminders,
      {
        email: user.notificationPreferences?.email?.bookingReminders ?? true,
        push: user.notificationPreferences?.push?.bookingReminders ?? true,
        inApp: user.notificationPreferences?.inApp?.bookingReminders ?? true,
      },
    ).catch((err: Error) =>
      console.error(`Failed to create booking reminders for ${userId}:`, err),
    );
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

  // Send payment status notification
  if (status === "FAILED") {
    const venue = await Venue.findById(booking.venueId).select("name");
    NotificationService.send({
      userId: payerUserId,
      type: "PAYMENT_FAILED",
      title: "Payment Failed",
      message: `Your payment for ${booking.sport} at ${venue?.name || "the venue"} has failed. Please try again.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        amount:
          booking.payments.find((p) => p.userId.toString() === payerUserId)
            ?.amount || 0,
      },
    }).catch((err: Error) =>
      console.error(
        `Failed to send payment failed notification to ${payerUserId}:`,
        err,
      ),
    );
  }

  return booking;
};

// ============================================
// GROUP BOOKING FUNCTIONS
// ============================================

export interface InitiateGroupBookingPayload extends InitiateBookingPayload {
  invitedFriendIds: string[];
  paymentType: "SINGLE" | "SPLIT";
}

/**
 * Initiate a group booking with friends
 */
export const initiateGroupBooking = async (
  payload: InitiateGroupBookingPayload,
): Promise<InitiateBookingResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate friend list
    if (!payload.invitedFriendIds || payload.invitedFriendIds.length === 0) {
      throw new Error("At least one friend must be invited for group booking");
    }

    // Verify all invitees are accepted friends
    for (const friendId of payload.invitedFriendIds) {
      const areFriends = await friendService.areFriends(
        payload.userId,
        friendId,
      );
      if (!areFriends) {
        const friendUser = await User.findById(friendId);
        throw new Error(`${friendUser?.name || "User"} is not your friend`);
      }
    }

    // Fetch invitee details
    const invitees = await User.find({
      _id: { $in: payload.invitedFriendIds },
      role: "PLAYER",
    });

    if (invitees.length !== payload.invitedFriendIds.length) {
      throw new Error("Some invited users are not valid players");
    }

    // Create the base booking using the standard flow
    const baseBookingResult = await initiateBooking(payload);
    const booking = baseBookingResult.booking;

    // Convert to group booking
    booking.bookingType = "GROUP";
    booking.organizerId = new mongoose.Types.ObjectId(payload.userId);
    booking.paymentType = payload.paymentType;
    booking.splitMethod = "EQUAL";

    // Set status to pending invites
    booking.status = "PENDING_INVITES";

    // Add organizer as first participant (auto-accepted)
    const organizer = await User.findById(payload.userId);
    if (!organizer) {
      throw new Error("Organizer not found");
    }

    booking.participants = [
      {
        userId: new mongoose.Types.ObjectId(payload.userId),
        name: organizer.name,
        status: "ACCEPTED",
        invitedAt: new Date(),
        respondedAt: new Date(),
      },
    ];

    // Add invited friends as participants
    for (const invitee of invitees) {
      booking.participants.push({
        userId: invitee._id as mongoose.Types.ObjectId,
        name: invitee.name,
        status: "INVITED",
        invitedAt: new Date(),
      });
    }

    // Calculate payment splits if split payment
    if (payload.paymentType === "SPLIT") {
      // Get venue and coach info for payments
      let venueOwnerId: string | undefined;
      let venuePrice = 0;
      let coachUserId: string | undefined;
      let coachPrice = 0;

      if (booking.venueId) {
        const venue = await Venue.findById(booking.venueId).populate("ownerId");
        if (venue && venue.ownerId) {
          venueOwnerId = (venue.ownerId as any)._id.toString();
          // Calculate venue price from booking
          const subtotal =
            booking.totalAmount -
            (booking.serviceFee || 0) -
            (booking.taxAmount || 0) +
            (booking.discountAmount || 0);
          if (booking.coachId) {
            const coach = await Coach.findById(booking.coachId).populate(
              "userId",
            );
            if (coach && coach.userId) {
              coachUserId = (coach.userId as any)._id.toString();
              // Rough estimation: split subtotal proportionally
              // This is simplified; in production you'd track exact venue/coach prices
              venuePrice = Math.round(subtotal * 0.6); // Assume 60% venue
              coachPrice = subtotal - venuePrice;
            }
          } else {
            venuePrice = subtotal;
          }
        }
      }

      // All participants (including organizer)
      const allParticipantIds = [payload.userId, ...payload.invitedFriendIds];

      if (venueOwnerId) {
        const paymentSplits = calculateGroupPaymentSplits(
          booking.totalAmount,
          venuePrice,
          venueOwnerId,
          allParticipantIds,
          coachPrice > 0 ? coachPrice : undefined,
          coachUserId,
        );

        // Convert IPayment[] to BookingPayment[] (string userId to ObjectId)
        booking.payments = paymentSplits.map((payment) => ({
          ...payment,
          userId: new mongoose.Types.ObjectId(payment.userId),
        }));
      }
    } else {
      // Single payment - organizer pays everything
      // Keep existing payment structure (venue + optional coach)
    }

    await booking.save({ session });

    // Create booking invitations
    const invitations = invitees.map((invitee) => ({
      bookingId: booking._id,
      inviterId: new mongoose.Types.ObjectId(payload.userId),
      inviteeId: invitee._id,
      venueId: booking.venueId,
      ...(booking.coachId ? { coachId: booking.coachId } : {}),
      sport: booking.sport,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      estimatedAmount:
        payload.paymentType === "SPLIT"
          ? Math.round((booking.totalAmount / (invitees.length + 1)) * 100) /
            100
          : 0,
      status: "PENDING",
    }));

    const insertedInvitations = await BookingInvitation.insertMany(
      invitations,
      { session },
    );

    // Send invitation emails/notifications
    const venue = await Venue.findById(booking.venueId).session(session);
    const inviter = await User.findById(payload.userId).session(session);

    if (venue && inviter) {
      // Send emails to all invitees (async, don't wait)
      for (const invitee of invitees) {
        const invitation = insertedInvitations.find(
          (inv) => inv.inviteeId.toString() === invitee._id.toString(),
        );
        if (invitation) {
          sendBookingInvitationEmail({
            inviteeName: invitee.name,
            inviteeEmail: invitee.email,
            inviterName: inviter.name,
            venueName: venue.name,
            sport: booking.sport,
            date: booking.date.toISOString(),
            startTime: booking.startTime,
            endTime: booking.endTime,
            estimatedAmount: invitation.estimatedAmount,
          }).catch((err: Error) =>
            console.error(
              `Failed to send booking invitation email to ${invitee.email}:`,
              err,
            ),
          );

          // Send real-time notification
          NotificationService.send({
            userId: invitee._id.toString(),
            type: "BOOKING_INVITATION",
            title: "New Booking Invitation",
            message: `${inviter.name} invited you to play ${booking.sport} at ${venue.name}`,
            data: {
              bookingId: booking._id.toString(),
              organizerId: payload.userId,
              organizerName: inviter.name,
              venueName: venue.name,
              sport: booking.sport,
              date: booking.date.toISOString(),
              startTime: booking.startTime,
              endTime: booking.endTime,
              estimatedAmount: invitation.estimatedAmount,
            },
          }).catch((err: Error) =>
            console.error(
              `Failed to send booking invitation notification to ${invitee._id}:`,
              err,
            ),
          );
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    return { booking };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(
      `Failed to initiate group booking: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Respond to a booking invitation (accept or decline)
 */
export const respondToBookingInvitation = async (
  userId: string,
  invitationId: string,
  accept: boolean,
): Promise<BookingDocument> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const invitation =
      await BookingInvitation.findById(invitationId).session(session);

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.inviteeId.toString() !== userId) {
      throw new Error("Not authorized to respond to this invitation");
    }

    if (invitation.status !== "PENDING") {
      throw new Error("Invitation has already been responded to");
    }

    // Update invitation status
    invitation.status = accept ? "ACCEPTED" : "DECLINED";
    invitation.respondedAt = new Date();
    await invitation.save({ session });

    // Update booking participant status
    const booking = await Booking.findById(invitation.bookingId).session(
      session,
    );
    if (!booking) {
      throw new Error("Booking not found");
    }

    const participant = booking.participants.find(
      (p) => p.userId.toString() === userId,
    );

    if (!participant) {
      throw new Error("Participant not found in booking");
    }

    participant.status = accept ? "ACCEPTED" : "DECLINED";
    participant.respondedAt = new Date();

    // If declined and payment is split, recalculate payments
    if (!accept && booking.paymentType === "SPLIT") {
      // Remove this user's payment
      booking.payments = booking.payments.filter(
        (p) => p.userId.toString() !== userId || p.userType !== "PLAYER",
      );

      // Recalculate split among remaining accepted participants
      const acceptedParticipants = booking.participants.filter(
        (p) => p.status === "ACCEPTED",
      );

      if (acceptedParticipants.length > 0) {
        const playerPayments = booking.payments.filter(
          (p) => p.userType === "PLAYER",
        );
        const totalPlayerAmount = playerPayments.reduce(
          (sum, p) => sum + p.amount,
          0,
        );

        // Redistribute total among accepted participants
        const amountPerPerson =
          Math.round((totalPlayerAmount / acceptedParticipants.length) * 100) /
          100;
        const sumOfSplits = amountPerPerson * (acceptedParticipants.length - 1);
        const lastPersonAmount =
          Math.round((totalPlayerAmount - sumOfSplits) * 100) / 100;

        // Update player payments
        const nonPlayerPayments = booking.payments.filter(
          (p) => p.userType !== "PLAYER",
        );
        booking.payments = [
          ...nonPlayerPayments,
          ...acceptedParticipants.map((p, index) => ({
            userId: p.userId,
            userType: "PLAYER" as const,
            amount:
              index === acceptedParticipants.length - 1
                ? lastPersonAmount
                : amountPerPerson,
            status: "PENDING" as const,
          })),
        ];
      }
    }

    // Check if all invitations have been responded to
    const allInvitations = await BookingInvitation.find({
      bookingId: booking._id,
    }).session(session);

    const allResponded = allInvitations.every(
      (inv: any) => inv.status !== "PENDING",
    );

    const anyAccepted = booking.participants.some(
      (p) =>
        p.status === "ACCEPTED" &&
        p.userId.toString() !== booking.organizerId.toString(),
    );

    // Update booking status if all have responded
    if (allResponded) {
      if (anyAccepted || booking.participants.length === 1) {
        // At least one person accepted, or organizer booking alone after declines
        booking.status = "CONFIRMED";
      } else {
        // Everyone declined
        booking.status = "CANCELLED";
        booking.cancelledAt = new Date();
        booking.cancellationReason = "All invitations declined";
      }
    }

    await booking.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Send notifications after successful transaction
    const invitee = await User.findById(userId);
    const organizer = await User.findById(booking.organizerId);
    const venue = await Venue.findById(booking.venueId);

    if (accept && invitee && organizer && venue) {
      // Notify organizer that someone accepted
      NotificationService.send({
        userId: booking.organizerId.toString(),
        type: "BOOKING_CONFIRMED",
        title: "Booking Invitation Accepted",
        message: `${invitee.name} accepted your invitation to play ${booking.sport} at ${venue.name}`,
        data: {
          bookingId: booking._id.toString(),
          participantId: userId,
          participantName: invitee.name,
          venueName: venue.name,
          sport: booking.sport,
          date: booking.date.toISOString(),
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      }).catch((err: Error) =>
        console.error(
          `Failed to send booking acceptance notification to organizer:`,
          err,
        ),
      );

      // If booking is now confirmed, notify all accepted participants
      if (booking.status === "CONFIRMED") {
        const acceptedParticipants = booking.participants.filter(
          (p) =>
            p.status === "ACCEPTED" &&
            p.userId.toString() !== booking.organizerId.toString(),
        );

        for (const participant of acceptedParticipants) {
          const participantUser = await User.findById(participant.userId);
          if (participantUser) {
            NotificationService.send({
              userId: participant.userId.toString(),
              type: "BOOKING_CONFIRMED",
              title: "Booking Confirmed",
              message: `Your booking for ${booking.sport} at ${venue.name} is confirmed!`,
              data: {
                bookingId: booking._id.toString(),
                venueName: venue.name,
                sport: booking.sport,
                date: booking.date.toISOString(),
                startTime: booking.startTime,
                endTime: booking.endTime,
              },
            }).catch((err: Error) =>
              console.error(
                `Failed to send booking confirmed notification to ${participant.userId}:`,
                err,
              ),
            );
          }
        }
      }
    }

    return booking;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(
      `Failed to respond to invitation: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Organizer covers unpaid shares in a split payment booking
 */
export const coverUnpaidShares = async (
  bookingId: string,
  organizerId: string,
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.organizerId.toString() !== organizerId) {
    throw new Error("Only the organizer can cover unpaid shares");
  }

  if (booking.bookingType !== "GROUP") {
    throw new Error("This is not a group booking");
  }
  if (booking.paymentType !== "SPLIT") {
    throw new Error("This booking does not use split payment");
  }

  // Find all unpaid player payments
  const unpaidPlayerPayments = booking.payments.filter(
    (p) => p.userType === "PLAYER" && p.status === "PENDING",
  );

  if (unpaidPlayerPayments.length === 0) {
    throw new Error("No unpaid shares to cover");
  }

  // Store user IDs for notifications
  const coveredUserIds = unpaidPlayerPayments.map((p) => p.userId.toString());

  // Calculate total unpaid amount
  const totalUnpaid = unpaidPlayerPayments.reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  // Find organizer's payment
  const organizerPayment = booking.payments.find(
    (p) => p.userId.toString() === organizerId && p.userType === "PLAYER",
  );

  if (organizerPayment) {
    // Increase organizer's payment to cover unpaid shares
    organizerPayment.amount += totalUnpaid;
  } else {
    // Create new payment for organizer covering unpaid shares
    booking.payments.push({
      userId: new mongoose.Types.ObjectId(organizerId),
      userType: "PLAYER",
      amount: totalUnpaid,
      status: "PENDING",
    });
  }

  // Remove unpaid payments from other users
  booking.payments = booking.payments.filter(
    (p) =>
      !(
        p.userType === "PLAYER" &&
        p.status === "PENDING" &&
        p.userId.toString() !== organizerId
      ),
  );

  await booking.save();

  // Send notifications to users whose payments were covered
  const venue = await Venue.findById(booking.venueId).select("name");
  const organizer = await User.findById(organizerId).select("name");

  for (const userId of coveredUserIds) {
    NotificationService.send({
      userId: userId,
      type: "PAYMENT_SPLIT_RECEIVED",
      title: "Payment Covered",
      message: `${organizer?.name || "The organizer"} has covered your share for ${booking.sport} at ${venue?.name || "the venue"}.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        organizerName: organizer?.name || "Organizer",
        organizerId: organizerId,
      },
    }).catch((err: Error) =>
      console.error(
        `Failed to send payment split received notification to ${userId}:`,
        err,
      ),
    );
  }

  return booking;
};

/**
 * Get booking invitations for a user
 */
export const getUserBookingInvitations = async (
  userId: string,
  status?: "PENDING" | "ACCEPTED" | "DECLINED",
): Promise<any[]> => {
  const query: any = { inviteeId: userId };
  if (status) {
    query.status = status;
  }

  const invitations = await BookingInvitation.find(query)
    .populate("inviterId", "name email photoUrl")
    .populate("venueId", "name location address")
    .populate("coachId", "name sport")
    .populate("bookingId")
    .sort({ createdAt: -1 });

  return invitations;
};

// Legacy function for backward compatibility
export const createBooking = initiateBooking;

/**
 * Cleanup stale booking slot locks
 * Removes locks for dates in the past (older than today)
 * Can be called periodically via cron job
 */
export const cleanupStaleBookingLocks = async (): Promise<number> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toISOString().split("T")[0] || "";

  // Delete locks with dateKey < today (past dates)
  const result = await BookingSlotLock.deleteMany({
    dateKey: { $lt: todayKey },
  });

  return result.deletedCount || 0;
};

/**
 * Cleanup expired bookings
 * Updates bookings that have passed their expiration time to CANCELLED
 * Only affects bookings that are still pending payment confirmation
 * Returns number of expired bookings cancelled
 */
export const cleanupExpiredBookings = async (): Promise<number> => {
  const now = new Date();

  const result = await Booking.updateMany(
    {
      status: "PENDING_PAYMENT", // Only cancel bookings awaiting payment
      expiresAt: { $lt: now },
    },
    {
      $set: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: "Booking expired - payment not confirmed",
      },
    },
  );

  return result.modifiedCount || 0;
};
