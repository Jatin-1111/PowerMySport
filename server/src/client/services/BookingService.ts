import { randomBytes } from "crypto";
import mongoose, { ClientSession } from "mongoose";
import { Booking, BookingDocument } from "../models/Booking";
import { BookingSlotLock } from "../models/BookingSlotLock";
import { Coach } from "../models/Coach";
import { CoachSubscription } from "../models/CoachSubscription";
import { User } from "../models/User";
import { Player } from "../models/Player";
import { Venue, VenueDocument } from "../models/Venue";
import Academy from "../../admin/models/Academy";
import {
  sendBookingLifecycleEmail,
  sendBookingInvitationEmail,
} from "../../utils/email";
import { getBookingExpirationTime } from "../../utils/timer";
import { validatePromoCode, applyPromoCode } from "./PromoCodeService";
import { isWithinOpeningHours } from "../../utils/openingHours";
import friendService from "./FriendService";
import BookingInvitation from "../models/BookingInvitation";
import {
  BookingWaitlist,
  BookingWaitlistDocument,
} from "../models/BookingWaitlist";
import {
  calculateGroupPaymentSplits,
  calculateSplitAmounts,
} from "../../utils/payment";
import { generateDynamicSlots } from "../../utils/booking";
import { emitSlotLocked } from "../sockets/bookingSocket";
import { NotificationService } from "./NotificationService";
import { ScheduledNotificationService } from "./ScheduledNotificationService";
import { BookingPaymentTransaction } from "../models/BookingPayment";
import {
  getPhonePeRefundStatus,
  initiatePhonePeRefund,
} from "../../shared/services/PhonePeService";

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
  academyId?: string;
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
const COACH_SUBSCRIPTIONS_ENFORCE_BOOKING =
  process.env.COACH_SUBSCRIPTIONS_ENFORCE_BOOKING === "true";
const SERVICE_FEE_RATE = Number(process.env.SERVICE_FEE_RATE ?? 0);
const TAX_RATE = Number(process.env.TAX_RATE ?? 0.05);

interface BookingCreatePayload {
  userId: string;
  venueId?: string;
  coachId?: string;
  academyId?: string;
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
  participantId: mongoose.Types.ObjectId | string;
  participantAge?: number;
  organizerId: string;
  payments?: any[];
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
  userId?: string | null,
  session?: ClientSession,
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const query = Booking.findOne({
    venueId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
      ],
    },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });

  if (session) {
    query.session(session);
  }

  const conflicts = await query;
  
  if (conflicts) {
    // If the conflict is an unpaid checkout by the same user, cancel it and ignore the conflict
    if (
      userId &&
      conflicts.userId.toString() === userId &&
      (conflicts.status === "PENDING_CONFIRMATION" || conflicts.status === "PENDING_INVITES") &&
      !conflicts.paymentConfirmedAt
    ) {
      conflicts.status = "CANCELLED";
      conflicts.cancellationReason = "Overwritten by a new booking attempt from the same user";
      if (session) {
        await conflicts.save({ session });
      } else {
        await conflicts.save();
      }
      return false; // Not a conflict anymore
    }
  }

  return Boolean(conflicts);
};

const hasConflictingCoachBooking = async (
  coachId: string,
  date: Date,
  startTime: string,
  endTime: string,
  userId?: string | null,
  session?: ClientSession,
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const query = Booking.findOne({
    coachId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
      ],
    },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });

  if (session) {
    query.session(session);
  }

  const conflicts = await query;

  if (conflicts) {
    // If the conflict is an unpaid checkout by the same user, cancel it and ignore the conflict
    if (
      userId &&
      conflicts.userId.toString() === userId &&
      (conflicts.status === "PENDING_CONFIRMATION" || conflicts.status === "PENDING_INVITES") &&
      !conflicts.paymentConfirmedAt
    ) {
      conflicts.status = "CANCELLED";
      conflicts.cancellationReason = "Overwritten by a new booking attempt from the same user";
      if (session) {
        await conflicts.save({ session });
      } else {
        await conflicts.save();
      }
      return false; // Not a conflict anymore
    }
  }

  return Boolean(conflicts);
};

const acquireResourceSlotLock = async (
  resourceType: "VENUE_SLOT" | "COACH_SLOT",
  resourceId: string,
  date: Date,
  startTime: string,
  session: ClientSession,
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new Error(
      `Invalid resource ID format for ${resourceType}: ${resourceId}`,
    );
  }
  await BookingSlotLock.findOneAndUpdate(
    {
      resourceType,
      resourceId: new mongoose.Types.ObjectId(resourceId),
      dateKey: `${getDateKey(date)}-${startTime}`,
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
          await acquireResourceSlotLock(
            "VENUE_SLOT",
            payload.venueId,
            payload.date,
            payload.startTime,
            session,
          );

          emitSlotLocked(payload.venueId, {
            slotStartTime: payload.startTime,
            dateKey: getDateKey(payload.date),
          });

          const hasVenueConflict = await hasConflictingVenueBooking(
            payload.venueId,
            payload.date,
            payload.startTime,
            payload.endTime,
            payload.userId,
            session,
          );

          if (hasVenueConflict) {
            throw new Error(
              "Selected time slot is already booked for this venue",
            );
          }
        }

        if (payload.coachId) {
          await acquireResourceSlotLock(
            "COACH_SLOT",
            payload.coachId,
            payload.date,
            payload.startTime,
            session,
          );

          const hasCoachConflict = await hasConflictingCoachBooking(
            payload.coachId,
            payload.date,
            payload.startTime,
            payload.endTime,
            payload.userId,
            session,
          );

          if (hasCoachConflict) {
            throw new Error(
              "Coach is not available for the selected time slot",
            );
          }
        }

        console.log(
          "[createBookingAtomically] about to construct Booking. userId:",
          JSON.stringify(payload.userId),
          "venueId:",
          JSON.stringify(payload.venueId),
          "coachId:",
          JSON.stringify(payload.coachId),
          "organizerId:",
          JSON.stringify(payload.organizerId),
          "participantId:",
          JSON.stringify(payload.participantId?.toString()),
          "payments:",
          JSON.stringify(payload.payments),
        );
        const booking = new Booking({
          userId: new mongoose.Types.ObjectId(payload.userId),
          ...(payload.venueId
            ? { venueId: new mongoose.Types.ObjectId(payload.venueId) }
            : {}),
          ...(payload.coachId
            ? { coachId: new mongoose.Types.ObjectId(payload.coachId) }
            : {}),
          ...(payload.academyId
            ? { academyId: new mongoose.Types.ObjectId(payload.academyId) }
            : {}),
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
          status: "PENDING_CONFIRMATION",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
          checkInCode: payload.checkInCode,
          // Awaiting provider confirmation before booking is confirmed
          participantName: payload.participantName,
          participantId: payload.participantId,
          ...(payload.participantAge !== undefined
            ? { participantAge: payload.participantAge }
            : {}),
          organizerId: new mongoose.Types.ObjectId(payload.organizerId),
          payments: payload.payments || [],
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
  return validatePromoCode(code, userId, subtotal, {
    hasCoach,
    context: "BOOKING",
  });
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
  const allSlots = generateDynamicSlots(6, 23, 60);

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

    // --- BOOKING DEBUG LOG START ---
    console.log(
      "[initiateBooking] RAW PAYLOAD:",
      JSON.stringify({
        userId: payload.userId,
        userIdType: typeof payload.userId,
        userIdIsValid: mongoose.Types.ObjectId.isValid(payload.userId),
        venueId: payload.venueId,
        venueIdIsValid: payload.venueId
          ? mongoose.Types.ObjectId.isValid(payload.venueId)
          : "N/A",
        coachId: payload.coachId,
        coachIdIsValid: payload.coachId
          ? mongoose.Types.ObjectId.isValid(payload.coachId)
          : "N/A",
        sport: payload.sport,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        dependentId: payload.dependentId,
        dependentIdIsValid: payload.dependentId
          ? mongoose.Types.ObjectId.isValid(payload.dependentId)
          : "N/A",
        hasPlayerLocation: Boolean(payload.playerLocation),
      }),
    );
    // --- BOOKING DEBUG LOG END ---

    // Fetch user for participant information
    console.log(
      "[initiateBooking] STEP 1: validating userId =",
      JSON.stringify(payload.userId),
      "type:",
      typeof payload.userId,
    );
    if (!mongoose.Types.ObjectId.isValid(payload.userId)) {
      throw new Error("Invalid user ID format");
    }
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new Error("User not found");
    }
    console.log("[initiateBooking] STEP 1 OK: user =", user._id.toString());

    // Clean up any existing abandoned booking for this exact same slot by this user
    // This allows them to "try again" immediately without hitting "Coach/Venue is not available"
    const startOfDay = new Date(payload.date);
    startOfDay.setHours(0, 0, 0, 0);

    const cleanupQuery: any = {
      userId: user._id,
      date: {
        $gte: startOfDay,
        $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
      },
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      status: "PENDING_CONFIRMATION",
    };
    if (payload.coachId) cleanupQuery.coachId = payload.coachId;
    if (payload.venueId) cleanupQuery.venueId = payload.venueId;

    const deletedAbandoned = await Booking.deleteMany(cleanupQuery);
    if (deletedAbandoned.deletedCount > 0) {
      console.log(`[initiateBooking] Cleaned up ${deletedAbandoned.deletedCount} abandoned booking(s) for user ${user._id} attempting to re-book`);
    }

    // Determine participant details
    let participantName = user.name;
    let participantId: any = user._id;
    let participantAge: number | undefined = undefined;

    if (payload.dependentId) {
      console.log(
        "[initiateBooking] STEP 2: validating dependentId =",
        JSON.stringify(payload.dependentId),
      );
      if (
        payload.dependentId === "undefined" ||
        !mongoose.Types.ObjectId.isValid(payload.dependentId)
      ) {
        throw new Error("Invalid dependent ID format");
      }
      // Booking is for a dependent (child)
      const dependent = await Player.findOne({
        _id: payload.dependentId,
        userId: user._id,
        type: "DEPENDENT",
      });
      if (!dependent) {
        throw new Error("Dependent not found");
      }

      // Validate dependent's age
      if (typeof dependent.age !== "number" || isNaN(dependent.age)) {
        throw new Error("Invalid age for dependent");
      }

      participantName = dependent.name;
      participantId = dependent._id;
      participantAge = dependent.age;
      console.log(
        "[initiateBooking] STEP 2 OK: dependent =",
        dependent._id.toString(),
        "participantId type:",
        typeof participantId,
        "value:",
        participantId?.toString(),
      );

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
      console.log(
        "[initiateBooking] STEP 2: no dependent, participantId =",
        participantId?.toString(),
      );
    }

    let venue: VenueDocument | null = null;

    if (payload.venueId) {
      console.log(
        "[initiateBooking] STEP 3: validating venueId =",
        JSON.stringify(payload.venueId),
      );
      if (!mongoose.Types.ObjectId.isValid(payload.venueId)) {
        throw new Error("Invalid venue ID format");
      }
      venue = await Venue.findById(payload.venueId).populate("ownerId");
      if (!venue) {
        throw new Error("Venue not found");
      }
      console.log(
        "[initiateBooking] STEP 3 OK: venue =",
        venue._id.toString(),
        "ownerId raw =",
        JSON.stringify(venue.ownerId),
        "ownerId type:",
        typeof venue.ownerId,
      );

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
      if (!mongoose.Types.ObjectId.isValid(payload.coachId)) {
        throw new Error("Invalid coach ID format");
      }
      const coach = await Coach.findById(payload.coachId).populate("userId");
      if (!coach) {
        throw new Error("Coach not found");
      }
      console.log(
        "[initiateBooking] STEP 4 OK: coach =",
        coach._id.toString(),
        "userId raw =",
        JSON.stringify((coach as any).userId),
        "serviceMode:",
        coach.serviceMode,
      );

      if (COACH_SUBSCRIPTIONS_ENFORCE_BOOKING) {
        const now = new Date();

        const coachSubscription = await CoachSubscription.findOne({
          coachId: coach._id,
          status: { $in: ["ACTIVE", "PAST_DUE"] },
        }).sort({ createdAt: -1 });

        if (!coachSubscription) {
          throw new Error("Coach subscription is inactive for new bookings");
        }

        const isActive = coachSubscription.status === "ACTIVE";
        const isPastDueWithinGrace =
          coachSubscription.status === "PAST_DUE" &&
          coachSubscription.gracePeriodEndsAt &&
          coachSubscription.gracePeriodEndsAt > now;

        if (!isActive && !isPastDueWithinGrace) {
          throw new Error("Coach subscription is inactive for new bookings");
        }
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
        payload.sport,
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

    let academyPrice = 0;

    if (payload.academyId) {
      if (!mongoose.Types.ObjectId.isValid(payload.academyId)) {
        throw new Error("Invalid academy ID format");
      }
      const academy = await Academy.findById(payload.academyId);
      if (!academy) {
        throw new Error("Academy not found");
      }
      if (!academy.isApproved) {
        throw new Error("Academy is not approved for bookings");
      }
      // sessionRatePerHour is stored in paise — convert to rupees
      const rateInRupees = (academy.sessionRatePerHour || 0) / 100;
      if (rateInRupees <= 0) {
        throw new Error("Academy pricing is not configured");
      }
      academyPrice = hours * rateInRupees;
    }

    const subtotal = venuePrice + coachPrice + academyPrice;
    const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE);
    const taxAmount = serviceFee > 0 ? Math.round(serviceFee * TAX_RATE) : 0;
    let discountAmount = 0;
    let validPromoCode: string | undefined = undefined;

    // Validate and apply promo code if provided
    if (payload.promoCode) {
      const promoValidation = await validatePromoCode(
        payload.promoCode,
        payload.userId,
        subtotal,
        {
          hasCoach: Boolean(payload.coachId),
          context: "BOOKING",
        },
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

    let singlePaymentSplits: any[] = [];
    if (payload.venueId || payload.coachId || payload.academyId) {
      const venueOwnerIdStr = venue?.ownerId
        ? (venue.ownerId as any)._id?.toString() || venue.ownerId.toString()
        : undefined;
      let coachUserIdStr: string | undefined;
      if (payload.coachId) {
        const coachInfo = await Coach.findById(payload.coachId);
        if (coachInfo && coachInfo.userId) {
          coachUserIdStr = coachInfo.userId.toString();
        }
      }

      console.log(
        "[initiateBooking] STEP 5 splits input: venueOwnerIdStr =",
        JSON.stringify(venueOwnerIdStr),
        "venueOwnerIdValid:",
        venueOwnerIdStr
          ? mongoose.Types.ObjectId.isValid(venueOwnerIdStr)
          : false,
        "coachUserIdStr =",
        JSON.stringify(coachUserIdStr),
        "coachUserIdValid:",
        coachUserIdStr
          ? mongoose.Types.ObjectId.isValid(coachUserIdStr)
          : false,
        "payerUserId =",
        JSON.stringify(payload.userId),
        "venuePrice =",
        venuePrice,
        "coachPrice =",
        coachPrice,
        "totalAmount =",
        totalAmount,
      );

      const calculatedSplits = calculateSplitAmounts(
        venuePrice,
        venueOwnerIdStr || "",
        coachPrice > 0 ? coachPrice : undefined,
        coachUserIdStr,
        payload.userId,
        totalAmount,
      );

      console.log(
        "[initiateBooking] STEP 5 calculatedSplits:",
        JSON.stringify(calculatedSplits),
      );

      singlePaymentSplits = calculatedSplits
        .filter((p) => p.userId && mongoose.Types.ObjectId.isValid(p.userId))
        .map((p) => ({
          userId: p.userId,
          userType: p.userType,
          amount: p.amount,
          status: p.status,
        }));

      console.log(
        "[initiateBooking] STEP 5 singlePaymentSplits after filter:",
        JSON.stringify(singlePaymentSplits),
      );
    }

    const bookingPayload: BookingCreatePayload = {
      userId: payload.userId,
      ...(payload.venueId ? { venueId: payload.venueId } : {}),
      ...(payload.coachId ? { coachId: payload.coachId } : {}),
      ...(payload.academyId ? { academyId: payload.academyId } : {}),
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
      organizerId: payload.userId,
      payments: singlePaymentSplits,
    };

    console.log(
      "[initiateBooking] STEP 6 bookingPayload:",
      JSON.stringify({
        userId: bookingPayload.userId,
        userIdValid: mongoose.Types.ObjectId.isValid(bookingPayload.userId),
        venueId: bookingPayload.venueId,
        coachId: bookingPayload.coachId,
        organizerId: bookingPayload.organizerId,
        organizerIdValid: mongoose.Types.ObjectId.isValid(
          bookingPayload.organizerId,
        ),
        participantId: bookingPayload.participantId?.toString(),
        participantIdValid: bookingPayload.participantId
          ? mongoose.Types.ObjectId.isValid(
              bookingPayload.participantId.toString(),
            )
          : false,
        paymentsCount: bookingPayload.payments?.length,
        payments: bookingPayload.payments,
      }),
    );

    const booking =
      payload.venueId || payload.coachId || payload.academyId
        ? await createBookingAtomically(bookingPayload)
        : await Booking.create({
            userId: new mongoose.Types.ObjectId(bookingPayload.userId),
            ...(bookingPayload.venueId
              ? { venueId: new mongoose.Types.ObjectId(bookingPayload.venueId) }
              : {}),
            ...(bookingPayload.coachId
              ? { coachId: new mongoose.Types.ObjectId(bookingPayload.coachId) }
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
            status: "PENDING_CONFIRMATION",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
            checkInCode: bookingPayload.checkInCode,
            // Awaiting provider confirmation before booking is confirmed
            participantName: bookingPayload.participantName,
            participantId: bookingPayload.participantId,
            ...(bookingPayload.participantAge !== undefined
              ? { participantAge: bookingPayload.participantAge }
              : {}),
            organizerId: new mongoose.Types.ObjectId(
              bookingPayload.organizerId,
            ),
            payments: bookingPayload.payments || [],
          });

    // Record promo code usage after successful booking
    if (validPromoCode && discountAmount > 0) {
      await applyPromoCode(
        validPromoCode,
        payload.userId,
        booking._id.toString(),
        null,
        discountAmount,
      );
    }

    return {
      booking,
    };
  } catch (error) {
    console.error("[initiateBooking] error:", error);
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
    .sort({ createdAt: -1 })
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
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "NO_SHOW",
      ],
    },
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
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
      ],
    },
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
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "NO_SHOW",
      ],
    },
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
 * Get all bookings for a coach (by coach userId)
 */
export const getCoachBookings = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  bookings: BookingDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const coach = await Coach.findOne({ userId }).select("_id");
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  const query = {
    coachId: coach._id,
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "NO_SHOW",
      ],
    },
  };
  const skip = (page - 1) * limit;

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate("userId venueId coachId")
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

const toPaise = (amount: number): number => Math.round(amount * 100);

const getBookingParticipantIds = (booking: BookingDocument): string[] => {
  const acceptedParticipants = booking.participants
    .filter((participant) => participant.status === "ACCEPTED")
    .map((participant) => participant.userId.toString());

  return Array.from(
    new Set([booking.organizerId.toString(), ...acceptedParticipants]),
  );
};

const getBookingLifecycleRecipients = async (
  booking: BookingDocument,
): Promise<
  Array<{ name: string; email: string; role: "PLAYER" | "PROVIDER" }>
> => {
  const recipients: Array<{
    name: string;
    email: string;
    role: "PLAYER" | "PROVIDER";
  }> = [];

  const player = await User.findById(booking.userId).select("name email");
  if (player?.email) {
    recipients.push({
      name: player.name || "Player",
      email: player.email,
      role: "PLAYER",
    });
  }

  if (booking.coachId) {
    const coach = await Coach.findById(booking.coachId)
      .populate("userId", "name email")
      .select("userId");
    const coachUser = coach?.userId as
      | { name?: string; email?: string }
      | undefined;
    if (coachUser?.email) {
      recipients.push({
        name: coachUser.name || "Coach",
        email: coachUser.email,
        role: "PROVIDER",
      });
    }
  }

  if (booking.venueId) {
    const venue = await Venue.findById(booking.venueId)
      .populate("ownerId", "name email")
      .select("ownerId");
    const venueOwner = venue?.ownerId as
      | { name?: string; email?: string }
      | undefined;
    if (venueOwner?.email) {
      recipients.push({
        name: venueOwner.name || "Venue Owner",
        email: venueOwner.email,
        role: "PROVIDER",
      });
    }
  }

  const uniqueRecipients = new Map<
    string,
    { name: string; email: string; role: "PLAYER" | "PROVIDER" }
  >();
  for (const recipient of recipients) {
    uniqueRecipients.set(recipient.email.toLowerCase(), recipient);
  }

  return Array.from(uniqueRecipients.values());
};

const sendBookingLifecycleEmails = async (
  booking: BookingDocument,
  state: "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED",
  extra: {
    refundAmount?: number;
    refundPercentage?: number;
    cancellationReason?: string;
  } = {},
): Promise<void> => {
  const recipients = await getBookingLifecycleRecipients(booking);
  const venueName =
    (await Venue.findById(booking.venueId).select("name"))?.name || "Venue";

  await Promise.all(
    recipients.map(async (recipient) => {
      try {
        await sendBookingLifecycleEmail({
          email: recipient.email,
          name: recipient.name,
          venueName,
          sport: booking.sport,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          totalAmount: booking.totalAmount,
          state,
          recipientRole: recipient.role,
          ...(booking.checkInCode &&
          state === "CONFIRMED" &&
          recipient.role === "PLAYER"
            ? { checkInCode: booking.checkInCode }
            : {}),
          ...extra,
        });
      } catch (error) {
        console.error(
          `Failed to send booking lifecycle email to ${recipient.email}:`,
          error,
        );
      }
    }),
  );
};

const buildRefundTargets = (
  booking: BookingDocument,
  refundPercentage: number,
): Array<{ userId: string; amountPaise: number }> => {
  const percent = Math.max(0, Math.min(100, refundPercentage));

  if (booking.payments && booking.payments.length > 0) {
    const playerPayments = booking.payments.filter(
      (payment) => payment.userType === "PLAYER" && payment.status === "PAID",
    );

    if (playerPayments.length > 0) {
      return playerPayments.map((payment) => ({
        userId: payment.userId.toString(),
        amountPaise: toPaise((payment.amount * percent) / 100),
      }));
    }
  }

  return [
    {
      userId: booking.userId.toString(),
      amountPaise: toPaise((booking.totalAmount * percent) / 100),
    },
  ];
};

const initiateBookingRefunds = async (
  booking: BookingDocument,
  refundPercentage: number,
  reason: string,
): Promise<{
  refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
  refundAmount: number;
}> => {
  const targets = buildRefundTargets(booking, refundPercentage).filter(
    (target) => target.amountPaise >= 100,
  );

  if (targets.length === 0) {
    throw new Error("No refundable payment amount found for this booking");
  }

  let hasFailure = false;
  let hasPending = false;
  let totalRefundPaise = 0;

  for (const target of targets) {
    const transaction = await BookingPaymentTransaction.findOne({
      bookingId: booking._id,
      userId: target.userId,
      status: "COMPLETED",
    }).sort({ createdAt: -1 });

    if (!transaction) {
      hasFailure = true;
      continue;
    }

    if (transaction.refundState) {
      hasPending = true;
      continue;
    }

    const refundMerchantId = `rf_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const refundResponse = await initiatePhonePeRefund({
      merchantRefundId: refundMerchantId,
      originalMerchantOrderId: transaction.merchantOrderId,
      amount: target.amountPaise / 100, // initiatePhonePeRefund expects rupees, but amountPaise is in paise
    });
    const refundState = refundResponse.state || "PENDING";
    const refundId = refundResponse.refundId ?? transaction.refundId;

    transaction.refundMerchantId = refundMerchantId;
    if (refundId) {
      transaction.refundId = refundId;
    }
    transaction.refundState = refundState;
    transaction.refundAmount = target.amountPaise;
    transaction.refundResponse = refundResponse.raw;
    await transaction.save();

    totalRefundPaise += target.amountPaise;

    if (refundState === "FAILED") {
      hasFailure = true;
    } else if (refundState !== "COMPLETED") {
      hasPending = true;
    }
  }

  if (totalRefundPaise === 0) {
    if (hasPending) {
      // If we skipped transactions because they already have a refundState, 
      // but the booking status was somehow still PENDING.
      return {
        refundStatus: "PROCESSED",
        refundAmount: 0 // The amount is already tracked in transactions
      };
    }
    throw new Error("No eligible payment transactions found for refund");
  }

  const refundStatus: "PENDING" | "PROCESSED" | "REJECTED" = hasFailure
    ? "REJECTED"
    : "PROCESSED"; // Platform considers it processed even if gateway is still pending

  return {
    refundStatus,
    refundAmount: Math.round(totalRefundPaise) / 100,
  };
};

export const processBookingRefund = async (
  bookingId: string,
  refundPercentage: number,
  reason: string,
): Promise<{
  booking: BookingDocument;
  refundAmount: number;
  refundPercentage: number;
  refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
}> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.refundStatus === "PROCESSED") {
    throw new Error("Refund already processed for this booking");
  }

  const refundResult = await initiateBookingRefunds(
    booking,
    refundPercentage,
    reason,
  );

  booking.refundAmount = refundResult.refundAmount;
  booking.refundStatus = refundResult.refundStatus;
  await booking.save();

  return {
    booking,
    refundAmount: refundResult.refundAmount,
    refundPercentage,
    refundStatus: refundResult.refundStatus,
  };
};

export const getBookingPhonePeRefundStatus = async (
  bookingId: string,
): Promise<{
  bookingId: string;
  refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
  refundAmount: number;
  transactions: Array<{
    merchantOrderId: string;
    merchantRefundId: string;
    refundId?: string;
    state?: string;
    amount: number;
  }>;
}> => {
  const booking = await Booking.findById(bookingId).select(
    "refundStatus refundAmount",
  );

  if (!booking) {
    throw new Error("Booking not found");
  }

  const refundableTransactions = await BookingPaymentTransaction.find({
    bookingId,
    refundMerchantId: { $exists: true, $ne: null },
  }).sort({ createdAt: -1 });

  if (refundableTransactions.length === 0) {
    throw new Error("No PhonePe refund transaction found for this booking");
  }

  let hasPending = false;
  let hasFailure = false;
  let totalRefundPaise = 0;

  const transactions: Array<{
    merchantOrderId: string;
    merchantRefundId: string;
    refundId?: string;
    state?: string;
    amount: number;
  }> = [];

  for (const transaction of refundableTransactions) {
    const merchantRefundId = transaction.refundMerchantId;
    if (!merchantRefundId) {
      continue;
    }

    const refundStatus = await getPhonePeRefundStatus(merchantRefundId);
    const latestState =
      refundStatus.state || transaction.refundState || "PENDING";
    const latestAmount =
      typeof refundStatus.amount === "number"
        ? refundStatus.amount
        : transaction.refundAmount || 0;
    const refundId = refundStatus.refundId ?? transaction.refundId;

    if (refundId) {
      transaction.refundId = refundId;
    }
    transaction.refundState = latestState;
    transaction.refundAmount = latestAmount;
    transaction.refundResponse = refundStatus.raw;
    await transaction.save();

    if (latestState === "FAILED") {
      hasFailure = true;
    } else if (latestState !== "COMPLETED") {
      hasPending = true;
    }

    totalRefundPaise += latestAmount;

    transactions.push({
      merchantOrderId: transaction.merchantOrderId,
      merchantRefundId,
      state: latestState,
      amount: Math.round(latestAmount) / 100,
      ...(refundId ? { refundId } : {}),
    });
  }

  const aggregateRefundStatus: "PENDING" | "PROCESSED" | "REJECTED" = hasFailure
    ? "REJECTED"
    : hasPending
      ? "PENDING"
      : "PROCESSED";

  booking.refundStatus = aggregateRefundStatus;
  booking.refundAmount = Math.round(totalRefundPaise) / 100;
  await booking.save();

  return {
    bookingId,
    refundStatus: aggregateRefundStatus,
    refundAmount: Math.round(totalRefundPaise) / 100,
    transactions,
  };
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
  requesterId: string,
  cancellationReason?: string,
): Promise<{
  booking: BookingDocument | null;
  refundAmount: number;
  refundPercentage: number;
}> => {
  // Scope to the booking's organizer so a user can only cancel their OWN
  // booking (prevents IDOR: cancelling/refunding arbitrary bookings).
  const booking = await Booking.findOne({
    _id: bookingId,
    organizerId: requesterId,
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
      ],
    },
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
      organizerId: requesterId,
      status: {
        $in: [
          "PENDING_CONFIRMATION",
          "PENDING_INVITES",
          "CONFIRMED",
          "IN_PROGRESS",
        ],
      },
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

    if (refundAmount > 0) {
      try {
        const refundResult = await initiateBookingRefunds(
          updatedBooking,
          refundPercentage,
          cancellationReason || "Cancelled by user",
        );
        updatedBooking.refundStatus = refundResult.refundStatus;
        updatedBooking.refundAmount = refundResult.refundAmount;
        await updatedBooking.save();
      } catch (refundError) {
        console.error(
          `Failed to initiate refund for booking ${updatedBooking._id.toString()}:`,
          refundError,
        );
      }
    }

    await sendBookingLifecycleEmails(updatedBooking, "CANCELLED", {
      cancellationReason: cancellationReason || "Cancelled by user",
      refundAmount,
      refundPercentage,
    });
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

  if (normalizedCode.length !== 8) {
    throw new Error("Check-in code must be 8 characters");
  }

  const booking = await Booking.findOne({ checkInCode: normalizedCode }).select(
    "+checkInCode",
  );

  if (!booking) {
    throw new Error("Invalid check-in code");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error(`Cannot check-in. Booking status is ${booking.status}`);
  }

  // Verify authorization (admin, venue owner, or assigned coach)
  if (requesterRole !== "ADMIN") {
    let isAuthorized = false;

    if (requesterRole === "COACH" && booking.coachId) {
      const coach = await Coach.findById(booking.coachId).select("userId");
      if (coach?.userId?.toString() === requesterUserId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && booking.venueId) {
      const venue = await Venue.findById(booking.venueId).select("ownerId");
      if (venue?.ownerId?.toString() === requesterUserId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
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

  // Check-in code expiration: exactly at booking end time
  const endParts = booking.endTime.split(":").map(Number);
  const endHour = endParts[0] ?? 0;
  const endMin = endParts[1] ?? 0;

  const bookingEndDateTime = new Date(booking.date);
  bookingEndDateTime.setHours(endHour, endMin, 0, 0);

  if (now > bookingEndDateTime) {
    throw new Error(
      "Check-in code has expired. Check-in is allowed only till the booking end time.",
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
  sport?: string,
): Promise<boolean> => {
  const coach = await Coach.findById(coachId);
  if (!coach) return false;

  const dayOfWeek = date.getDay();

  // Resolve slots: prefer sport-specific availability, fall back to generic availability.
  // availabilityBySport is stored as a Mongoose Map — always use Map API.
  const availabilityBySport = (coach as any).availabilityBySport as
    | Map<
        string,
        Array<{ dayOfWeek: number; startTime: string; endTime: string }>
      >
    | undefined;

  const sportSlots =
    sport && availabilityBySport instanceof Map
      ? availabilityBySport.get(sport)
      : undefined;

  const sourceSlots: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }> =
    (sportSlots && sportSlots.length > 0 ? sportSlots : coach.availability) ||
    [];

  // Filter all slots for this day (a coach may have multiple windows per day).
  const daySlots = sourceSlots.filter((a) => a.dayOfWeek === dayOfWeek);
  if (daySlots.length === 0) return false;

  // Normalize all times to HH:mm so string comparison is safe regardless of
  // whether the stored availability used "9:00" or "09:00".
  const norm = (t: string) => {
    const [h = "0", m = "00"] = t.split(":");
    return `${String(parseInt(h, 10)).padStart(2, "0")}:${m}`;
  };
  const normStart = norm(startTime);
  const normEnd = norm(endTime);

  // The requested time must fit within at least one of the day's availability windows.
  const isWithinAnySlot = daySlots.some(
    (slot) =>
      normStart >= norm(slot.startTime) && normEnd <= norm(slot.endTime),
  );
  if (!isWithinAnySlot) return false;

  // Check for conflicting bookings on the same day.
  const existingBooking = await Booking.findOne({
    coachId,
    date: {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
    },
    status: {
      $in: [
        "PENDING_CONFIRMATION",
        "PENDING_INVITES",
        "CONFIRMED",
        "IN_PROGRESS",
      ],
    },
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
      status: { $in: ["PENDING_CONFIRMATION", "CONFIRMED"] },
      confirmationEmailSentAt: { $exists: false },
    },
    {
      $set: { confirmationEmailSentAt: new Date() },
    },
    { new: true },
  ).select("+checkInCode");

  if (emailClaimedBooking) {
    await sendBookingLifecycleEmails(
      emailClaimedBooking,
      emailClaimedBooking.status === "CONFIRMED"
        ? "CONFIRMED"
        : "PENDING_CONFIRMATION",
    );
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
  if (updatedBooking.status !== "CONFIRMED") {
    NotificationService.send({
      userId: userId,
      type: "BOOKING_STATUS_UPDATED",
      title: "Awaiting provider confirmation",
      message: `Your booking for ${updatedBooking.sport} is awaiting provider confirmation.`,
      data: {
        bookingId: updatedBooking._id.toString(),
        status: updatedBooking.status,
        date: updatedBooking.date.toISOString(),
        startTime: updatedBooking.startTime,
        endTime: updatedBooking.endTime,
      },
    }).catch(() => {});

    return updatedBooking;
  }

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
        coachName: undefined,
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

const sendBookingPaymentConfirmation = async (
  bookingId: string,
): Promise<void> => {
  const booking = await Booking.findById(bookingId).select("+checkInCode");

  if (!booking) {
    return;
  }

  const emailClaimedBooking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      confirmationEmailSentAt: { $exists: false },
    },
    {
      $set: { confirmationEmailSentAt: new Date() },
    },
    { new: true },
  ).select("+checkInCode");

  if (emailClaimedBooking) {
    await sendBookingLifecycleEmails(
      emailClaimedBooking,
      emailClaimedBooking.status === "CONFIRMED"
        ? "CONFIRMED"
        : "PENDING_CONFIRMATION",
    );
  }

  const venue = await Venue.findById(booking.venueId).select("name");
  NotificationService.send({
    userId: booking.userId.toString(),
    type: "PAYMENT_CONFIRMED",
    title: "Payment Confirmed",
    message: `Your payment for ${booking.sport} at ${venue?.name || "the venue"} has been confirmed!`,
    data: {
      bookingId: booking._id.toString(),
      venueName: venue?.name || "Venue",
      sport: booking.sport,
      date: booking.date.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalAmount: booking.totalAmount,
    },
  }).catch((err: Error) =>
    console.error(
      `Failed to send payment confirmation notification to ${booking.userId.toString()}:`,
      err,
    ),
  );

  if (booking.status !== "CONFIRMED") {
    NotificationService.send({
      userId: booking.userId.toString(),
      type: "BOOKING_STATUS_UPDATED",
      title: "Awaiting provider confirmation",
      message: `Your booking for ${booking.sport} is awaiting provider confirmation.`,
      data: {
        bookingId: booking._id.toString(),
        status: booking.status,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
    }).catch(() => {});

    return;
  }

  NotificationService.send({
    userId: booking.userId.toString(),
    type: "BOOKING_CONFIRMED",
    title: "Booking confirmed",
    message: `Your booking for ${booking.sport} is confirmed.`,
    data: {
      bookingId: booking._id.toString(),
      status: booking.status,
      date: booking.date.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
  }).catch(() => {});

  const user = await User.findById(booking.userId).select(
    "reminderPreferences notificationPreferences",
  );
  if (user && user.reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: booking._id,
        userId: booking.userId,
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        sport: booking.sport,
        venueName: venue?.name,
        coachName: undefined,
      },
      user.reminderPreferences.bookingReminders,
      {
        email: user.notificationPreferences?.email?.bookingReminders ?? true,
        push: user.notificationPreferences?.push?.bookingReminders ?? true,
        inApp: user.notificationPreferences?.inApp?.bookingReminders ?? true,
      },
    ).catch((err: Error) =>
      console.error(
        `Failed to create booking reminders for ${booking.userId.toString()}:`,
        err,
      ),
    );
  }
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

  const wasPaymentConfirmed = Boolean(booking.paymentConfirmedAt);

  if (booking.payments && booking.payments.length > 0) {
    booking.payments = booking.payments.map((payment) => {
      if (payment.userId.toString() !== payerUserId) {
        return payment;
      }

      // Use toObject() to safely spread Mongoose subdocuments
      const plain =
        typeof (payment as any).toObject === "function"
          ? (payment as any).toObject()
          : payment;
      return {
        ...plain,
        status,
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      };
    });
  }

  // Set paymentConfirmedAt when all PLAYER entries are PAID.
  // VENUE_LISTER/COACH entries represent payee splits (payout tracking)
  // and are released by the scheduled payout job, not by the player paying.
  if (
    status === "PAID" &&
    (!booking.payments.length ||
      booking.payments
        .filter((payment) => payment.userType === "PLAYER")
        .every((payment) => payment.status === "PAID"))
  ) {
    booking.paymentConfirmedAt = new Date();
  }

  if (session) {
    await booking.save({ session });
  } else {
    await booking.save();
  }

  if (status === "PAID" && booking.paymentConfirmedAt && !wasPaymentConfirmed) {
    await sendBookingPaymentConfirmation(bookingId);
  }

  // Send payment status notification and delete booking if failed
  if (status === "FAILED") {
    // Automatically delete the booking if payment fails
    // This removes unpaid bookings from showing up for coaches/venues/players
    if (session) {
      await Booking.deleteOne({ _id: booking._id }, { session });
    } else {
      await Booking.deleteOne({ _id: booking._id });
    }

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
        booking.status = "PENDING_CONFIRMATION";
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

      // If booking is now pending confirmation, notify all accepted participants
      if (booking.status === "PENDING_CONFIRMATION") {
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
              type: "BOOKING_STATUS_UPDATED",
              title: "Booking awaiting confirmation",
              message: `Your booking for ${booking.sport} at ${venue.name} is awaiting provider confirmation.`,
              data: {
                bookingId: booking._id.toString(),
                venueName: venue.name,
                sport: booking.sport,
                date: booking.date.toISOString(),
                startTime: booking.startTime,
                endTime: booking.endTime,
                status: booking.status,
              },
            }).catch((err: Error) =>
              console.error(
                `Failed to send booking pending notification to ${participant.userId}:`,
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

const isProviderAuthorizedForBooking = async (
  booking: BookingDocument,
  providerUserId: string,
): Promise<boolean> => {
  const checks: Array<Promise<boolean>> = [];

  if (booking.coachId) {
    checks.push(
      Coach.findById(booking.coachId)
        .select("userId")
        .then((coach) => coach?.userId?.toString() === providerUserId),
    );
  }

  if (booking.venueId) {
    checks.push(
      Venue.findById(booking.venueId)
        .select("ownerId")
        .then((venue) => venue?.ownerId?.toString() === providerUserId),
    );
  }

  if (checks.length === 0) {
    return false;
  }

  const results = await Promise.all(checks);
  return results.some(Boolean);
};

export const confirmBookingByProvider = async (
  bookingId: string,
  providerUserId: string,
): Promise<BookingDocument> => {
  const booking = await Booking.findById(bookingId).select("+checkInCode");

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "PENDING_CONFIRMATION") {
    throw new Error("Booking is not awaiting confirmation");
  }

  const isAuthorized = await isProviderAuthorizedForBooking(
    booking,
    providerUserId,
  );
  if (!isAuthorized) {
    throw new Error("Not authorized to confirm this booking");
  }

  if (!booking.paymentConfirmedAt) {
    throw new Error("Payment has not been confirmed yet");
  }

  booking.status = "CONFIRMED";
  await booking.save();

  const venue = await Venue.findById(booking.venueId).select("name");
  const participantIds = getBookingParticipantIds(booking);

  for (const participantId of participantIds) {
    NotificationService.send({
      userId: participantId,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed",
      message: `Your booking for ${booking.sport} at ${venue?.name || "the venue"} is confirmed.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
    }).catch(() => {});
  }

  await sendBookingLifecycleEmails(booking, "CONFIRMED");

  const user = await User.findById(booking.userId).select(
    "reminderPreferences notificationPreferences",
  );
  if (user && user.reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: booking._id,
        userId: booking.userId,
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        sport: booking.sport,
        venueName: venue?.name,
        coachName: undefined,
      },
      user.reminderPreferences.bookingReminders,
      {
        email: user.notificationPreferences?.email?.bookingReminders ?? true,
        push: user.notificationPreferences?.push?.bookingReminders ?? true,
        inApp: user.notificationPreferences?.inApp?.bookingReminders ?? true,
      },
    ).catch((err: Error) =>
      console.error(
        `Failed to create booking reminders for ${booking.userId.toString()}:`,
        err,
      ),
    );
  }

  return booking;
};

/**
 * Reschedule a confirmed booking to a new date/time — coach-initiated.
 * Only CONFIRMED bookings can be rescheduled.
 */
export const rescheduleBookingByCoach = async (
  bookingId: string,
  coachUserId: string,
  newDate: Date,
  newStartTime: string,
  newEndTime: string,
): Promise<BookingDocument> => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");

  if (booking.status !== "CONFIRMED") {
    throw new Error("Only confirmed bookings can be rescheduled");
  }

  // Verify the requesting user is actually the assigned coach
  const coach = await Coach.findOne({ userId: coachUserId }).select("_id");
  if (!coach) throw new Error("Coach profile not found");

  if (!booking.coachId || booking.coachId.toString() !== coach._id.toString()) {
    throw new Error("Not authorized to reschedule this booking");
  }

  // Check that the new slot doesn't conflict with another booking
  const conflict = await Booking.findOne({
    _id: { $ne: booking._id },
    coachId: coach._id,
    date: newDate,
    status: { $in: ["CONFIRMED", "IN_PROGRESS", "PENDING_CONFIRMATION"] },
    $or: [
      { startTime: { $lt: newEndTime }, endTime: { $gt: newStartTime } },
    ],
  });

  if (conflict) {
    throw new Error(
      "The requested time slot conflicts with an existing booking",
    );
  }

  booking.date = newDate;
  booking.startTime = newStartTime;
  booking.endTime = newEndTime;
  await booking.save();

  return booking;
};

export const rejectBookingByProvider = async (
  bookingId: string,
  providerUserId: string,
  reason?: string,
): Promise<{
  booking: BookingDocument;
  refundAmount: number;
  refundStatus?: "PENDING" | "PROCESSED" | "REJECTED";
}> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "PENDING_CONFIRMATION") {
    throw new Error("Booking is not awaiting confirmation");
  }

  const isAuthorized = await isProviderAuthorizedForBooking(
    booking,
    providerUserId,
  );
  if (!isAuthorized) {
    throw new Error("Not authorized to reject this booking");
  }

  booking.status = "CANCELLED";
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason || "Rejected by provider";
  await booking.save();

  let refundAmount = 0;
  let refundStatus: "PENDING" | "PROCESSED" | "REJECTED" | undefined;
  if (booking.paymentConfirmedAt) {
    try {
      const refund = await processBookingRefund(
        bookingId,
        100,
        booking.cancellationReason,
      );
      refundAmount = refund.refundAmount;
      refundStatus = refund.refundStatus;
    } catch (error) {
      console.error("Failed to process provider rejection refund:", error);
    }
  }

  const venue = await Venue.findById(booking.venueId).select("name");
  const participantIds = getBookingParticipantIds(booking);

  for (const participantId of participantIds) {
    NotificationService.send({
      userId: participantId,
      type: "BOOKING_CANCELLED",
      title: "Booking declined",
      message: `Your booking for ${booking.sport} at ${venue?.name || "the venue"} was declined by the provider.`,
      data: {
        bookingId: booking._id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        refundAmount,
        refundStatus,
      },
    }).catch(() => {});
  }

  ScheduledNotificationService.cancelBookingReminders(booking._id).catch(
    () => {},
  );

  await sendBookingLifecycleEmails(booking, "CANCELLED", {
    cancellationReason: booking.cancellationReason,
    refundAmount,
    refundPercentage: 100,
  });

  return {
    booking,
    refundAmount,
    ...(refundStatus !== undefined ? { refundStatus } : {}),
  };
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
 * Deletes bookings that have passed their expiration time without payment
 * Only affects bookings that are still pending payment confirmation
 * Returns number of expired bookings deleted
 */
export const cleanupExpiredBookings = async (): Promise<number> => {
  const now = new Date();

  const result = await Booking.deleteMany(
    {
      status: { $in: ["PENDING_CONFIRMATION", "PENDING_INVITES"] },
      paymentConfirmedAt: { $exists: false },
      expiresAt: { $lt: now },
    }
  );

  return result.deletedCount || 0;
};

// ============================================
// WEBHOOK RECONCILIATION FOR BOOKING PAYMENTS
// ============================================

/**
 * Helper to extract a string value from a nested webhook payload.
 * PhonePe webhooks can nest data in various structures.
 */
const pickString = (...values: unknown[]): string | undefined => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
};

const asRec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * Reconcile a booking payment from a raw webhook payload.
 * Called by the outbox worker as a fallback after coach-subscription reconciliation.
 *
 * - Extracts merchantOrderId and payment state from the webhook payload
 * - Finds a matching BookingPaymentTransaction
 * - If found and state changed, updates both the transaction and the booking
 *
 * Returns the updated transaction, or null if no matching booking transaction was found.
 */
export const reconcileBookingPaymentFromWebhookPayload = async (
  rawPayload: unknown,
): Promise<any> => {
  const payload = asRec(rawPayload);
  const inner = asRec(payload.payload);
  const data = asRec(payload.data);

  const merchantOrderId = pickString(
    payload.originalMerchantOrderId,
    payload.merchantOrderId,
    inner.originalMerchantOrderId,
    inner.merchantOrderId,
    data.originalMerchantOrderId,
    data.merchantOrderId,
    asRec(inner.paymentDetails).merchantOrderId,
    asRec(data.paymentDetails).merchantOrderId,
  );

  if (!merchantOrderId) {
    return null;
  }

  // Only process booking-related transactions (merchant IDs start with "bk_")
  if (!merchantOrderId.startsWith("bk_")) {
    return null;
  }

  const transaction = await BookingPaymentTransaction.findOne({
    merchantOrderId,
  });
  if (!transaction) {
    return null;
  }

  // Extract payment state
  const rawState = pickString(
    payload.state,
    inner.state,
    data.state,
    asRec(inner.paymentDetails).state,
    asRec(data.paymentDetails).state,
  );

  const normalizeState = (s?: string): string => {
    if (!s) return "PENDING";
    const upper = s.toUpperCase();
    if (upper === "COMPLETED") return "COMPLETED";
    if (upper === "FAILED") return "FAILED";
    return "PENDING";
  };

  const state = normalizeState(rawState);

  // Store the webhook callback on the transaction
  transaction.callbackPayload = payload as any;
  transaction.state = state;

  if (state === "COMPLETED" && transaction.status !== "COMPLETED") {
    transaction.status = "COMPLETED";
    await updatePaymentStatus(
      transaction.bookingId.toString(),
      transaction.userId.toString(),
      "PAID",
    );
    console.info(
      `[BookingWebhook] Payment confirmed for booking ${transaction.bookingId}, merchantOrderId=${merchantOrderId}`,
    );
  } else if (state === "FAILED" && transaction.status !== "FAILED") {
    transaction.status = "FAILED";
    await updatePaymentStatus(
      transaction.bookingId.toString(),
      transaction.userId.toString(),
      "FAILED",
    );
    console.info(
      `[BookingWebhook] Payment failed for booking ${transaction.bookingId}, merchantOrderId=${merchantOrderId}`,
    );
  }

  await transaction.save();
  return transaction;
};
