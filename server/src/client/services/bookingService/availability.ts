import mongoose, { ClientSession } from "mongoose";
import { Booking, BookingDocument } from "../../models/Booking";
import { BookingSlotLock } from "../../models/BookingSlotLock";
import { Coach } from "../../models/Coach";
import Academy from "../../../admin/models/Academy";
import { validatePromoCode } from "../PromoCodeService";
import { generateDynamicSlots } from "../../../utils/booking";
import { emitSlotLocked } from "../../sockets/bookingSocket";
import {
  log,
  MAX_TRANSACTION_RETRIES,
  type BookingCreatePayload,
  toDayRange,
  getDateKey,
  isRetryableTransactionError,
} from "./shared";

const hasConflictingVenueBooking = async (
  venueId: string,
  date: Date,
  startTime: string,
  endTime: string,
  userId?: string | null,
  session?: ClientSession
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const query = Booking.findOne({
    venueId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: {
      $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER", "PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"],
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
      (conflicts.status === "AWAITING_PAYMENT" || conflicts.status === "PENDING_INVITES") &&
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
  session?: ClientSession
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const query = Booking.findOne({
    coachId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: {
      $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER", "PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"],
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
      (conflicts.status === "AWAITING_PAYMENT" || conflicts.status === "PENDING_INVITES") &&
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

/**
 * Academies are capacity-based, not exclusive: up to `maxBatchSize` students
 * can hold the same slot. Returns true while there is still room.
 */
export const hasAcademyCapacity = async (
  academyId: string,
  date: Date,
  startTime: string,
  endTime: string,
  maxBatchSize?: number,
  session?: ClientSession
): Promise<boolean> => {
  const capacity = typeof maxBatchSize === "number" && maxBatchSize > 0 ? maxBatchSize : 1;

  const { start, end } = toDayRange(date);
  const query = Booking.countDocuments({
    academyId,
    date: {
      $gte: start,
      $lt: end,
    },
    status: {
      $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER", "PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"],
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

  const taken = await query;
  return taken < capacity;
};

const acquireResourceSlotLock = async (
  resourceType: "VENUE_SLOT" | "COACH_SLOT" | "ACADEMY_SLOT",
  resourceId: string,
  date: Date,
  startTime: string,
  session: ClientSession
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    throw new Error(`Invalid resource ID format for ${resourceType}: ${resourceId}`);
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
    }
  );
};

export const createBookingAtomically = async (
  payload: BookingCreatePayload
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
            session
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
            session
          );

          if (hasVenueConflict) {
            throw new Error("Selected time slot is already booked for this venue");
          }
        }

        if (payload.coachId) {
          await acquireResourceSlotLock(
            "COACH_SLOT",
            payload.coachId,
            payload.date,
            payload.startTime,
            session
          );

          const hasCoachConflict = await hasConflictingCoachBooking(
            payload.coachId,
            payload.date,
            payload.startTime,
            payload.endTime,
            payload.userId,
            session
          );

          if (hasCoachConflict) {
            throw new Error("Coach is not available for the selected time slot");
          }
        }

        if (payload.academyId) {
          // Serialize concurrent bookers on the same academy slot so the
          // capacity count below and the insert that follows can't interleave
          // and oversubscribe the batch.
          await acquireResourceSlotLock(
            "ACADEMY_SLOT",
            payload.academyId,
            payload.date,
            payload.startTime,
            session
          );

          // Re-read maxBatchSize inside the transaction rather than trusting
          // the value read during pricing — the academy may have been edited.
          const academy = await Academy.findById(payload.academyId)
            .select("maxBatchSize")
            .session(session);

          const academyHasRoom = await hasAcademyCapacity(
            payload.academyId,
            payload.date,
            payload.startTime,
            payload.endTime,
            academy?.maxBatchSize,
            session
          );

          if (!academyHasRoom) {
            throw new Error("This academy batch is already full for the selected time slot");
          }
        }

        log.info(
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
          JSON.stringify(payload.payments)
        );
        const booking = new Booking({
          userId: new mongoose.Types.ObjectId(payload.userId),
          ...(payload.venueId ? { venueId: new mongoose.Types.ObjectId(payload.venueId) } : {}),
          ...(payload.coachId ? { coachId: new mongoose.Types.ObjectId(payload.coachId) } : {}),
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
          ...(payload.discountAmount ? { discountAmount: payload.discountAmount } : {}),
          status: "AWAITING_PAYMENT",
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
          ...(payload.delivery ? { delivery: payload.delivery } : {}),
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
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_RETRIES) {
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

/**
 * Check if a time slot is available for a venue.
 * Use `createBookingAtomically` for race-safe booking creation.
 */
export const isSlotAvailable = async (
  venueId: string,
  date: Date,
  startTime: string,
  endTime: string
): Promise<boolean> => {
  const hasConflict = await hasConflictingVenueBooking(venueId, date, startTime, endTime);
  return !hasConflict;
};

export const validatePromoCodeForUser = async (
  code: string,
  userId: string,
  subtotal: number,
  hasCoach: boolean
): Promise<{ isValid: boolean; discountAmount: number; message?: string }> => {
  return validatePromoCode(code, userId, subtotal, {
    hasCoach,
    context: "BOOKING",
  });
};

export const getAlternateVenueSlots = (
  bookedSlots: { startTime: string; endTime: string }[],
  preferredStartTime: string,
  preferredEndTime: string,
  limit: number = 4
): string[] => {
  const requestedDurationMinutes = Math.max(
    30,
    ((): number => {
      const [startHour = 0, startMinute = 0] = preferredStartTime.split(":").map(Number);
      const [endHour = 0, endMinute = 0] = preferredEndTime.split(":").map(Number);
      return endHour * 60 + endMinute - (startHour * 60 + startMinute);
    })()
  );

  const booked = bookedSlots;
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

  const preferredIndex = allSlots.findIndex((slot) => slot === preferredStartTime);
  const sorted = allSlots
    .map((slot, index) => ({
      slot,
      distance: preferredIndex >= 0 ? Math.abs(index - preferredIndex) : index,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.slot);

  return sorted.filter((slot) => canFit(slot)).slice(0, Math.max(1, limit));
};

/**
 * Check coach availability (kept synchronized with CoachService.checkCoachAvailability)
 * Duplicated to avoid circular dependency between services
 */
export const checkCoachAvailabilityForBooking = async (
  coachId: string,
  date: Date,
  startTime: string,
  endTime: string,
  sport?: string
): Promise<boolean> => {
  const coach = await Coach.findById(coachId);
  if (!coach) return false;

  const dayOfWeek = date.getUTCDay(); // date is UTC-midnight-anchored — see combineDateAndTimeIST

  // Resolve slots: prefer sport-specific availability, fall back to generic availability.
  // availabilityBySport is stored as a Mongoose Map — always use Map API.
  const availabilityBySport = (coach as any).availabilityBySport as
    Map<string, Array<{ dayOfWeek: number; startTime: string; endTime: string }>> | undefined;

  const sportSlots =
    sport && availabilityBySport instanceof Map ? availabilityBySport.get(sport) : undefined;

  const sourceSlots: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }> = (sportSlots && sportSlots.length > 0 ? sportSlots : coach.availability) || [];

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
    (slot) => normStart >= norm(slot.startTime) && normEnd <= norm(slot.endTime)
  );
  if (!isWithinAnySlot) return false;

  // Check for conflicting bookings on the same day.
  const { start: dayStart, end: dayEnd } = toDayRange(date);
  const existingBooking = await Booking.findOne({
    coachId,
    date: {
      $gte: dayStart,
      $lt: dayEnd,
    },
    status: {
      $in: ["AWAITING_PAYMENT", "AWAITING_PROVIDER", "PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"],
    },
    $or: [
      { startTime: { $lte: startTime }, endTime: { $gt: startTime } },
      { startTime: { $lt: endTime }, endTime: { $gte: endTime } },
      { startTime: { $gte: startTime }, endTime: { $lte: endTime } },
    ],
  });
  return !existingBooking;
};
