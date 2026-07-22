import { randomBytes } from "crypto";
import prisma from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import type {
  Booking,
  BookingPaymentLeg,
  BookingParticipant,
  BookingWaitlist,
  BookingStatus,
  PaymentUserType,
  PaymentLegStatus,
  Venue,
  VenueOpeningHour,
} from "@prisma/client";
import type { OpeningHours } from "../../types/index";
import {
  sendBookingLifecycleEmail,
  sendBookingInvitationEmail,
  sendWaitlistSlotAvailableEmail,
} from "../../utils/email";
import { validatePromoCode, applyPromoCode } from "./PromoCodeService";
import {
  isWithinOpeningHours,
  combineDateAndTimeIST,
  IST_OFFSET_MINUTES,
} from "../../utils/openingHours";
import friendService from "./FriendService";
import {
  calculateGroupPaymentSplits,
  calculateSplitAmounts,
} from "../../utils/payment";
import { generateDynamicSlots } from "../../utils/booking";
import { emitSlotLocked } from "../sockets/bookingSocket";
import { NotificationService } from "./NotificationService";
import { ScheduledNotificationService } from "./ScheduledNotificationService";
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

// ---------------------------------------------------------------------------
// Local types. There is no per-model file / Mongoose document anymore; a
// "booking document" is a Prisma Booking row plus its normalized children
// (payments = BookingPaymentLeg, participants = BookingParticipant) hydrated
// via `include`, so the response JSON keeps the historical embedded shape.
// ---------------------------------------------------------------------------
type BookingDocument = Booking & {
  payments: BookingPaymentLeg[];
  participants: BookingParticipant[];
};

type BookingWaitlistDocument = BookingWaitlist;
type VenueDocument = Venue;

const bookingChildren = { payments: true, participants: true } as const;

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
const COACH_SUBSCRIPTIONS_ENFORCE_BOOKING =
  process.env.COACH_SUBSCRIPTIONS_ENFORCE_BOOKING === "true";
const SERVICE_FEE_RATE = Number(process.env.SERVICE_FEE_RATE ?? 0);
const TAX_RATE = Number(process.env.TAX_RATE ?? 0.05);

// Statuses considered "occupying" for conflict/listing checks.
const ACTIVE_STATUSES: BookingStatus[] = [
  "PENDING_CONFIRMATION",
  "PENDING_INVITES",
  "CONFIRMED",
  "IN_PROGRESS",
];

const PROVIDER_LIST_STATUSES: BookingStatus[] = [
  "PENDING_CONFIRMATION",
  "PENDING_INVITES",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
];

// Amount columns are integers in Postgres; the historical rupee math can yield
// fractional values, so round on write. Return values keep original precision.
const toInt = (value: number): number => Math.round(value);

// Replaces mongoose ObjectId validity checks — Postgres ids are cuids, so we
// only guard against empty / missing ids to preserve the "Invalid ID" throws.
const isValidId = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

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
  participantId: string;
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
    const exists = await prisma.booking.findFirst({
      where: { checkInCode: code },
      select: { id: true },
    });
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

// toDayRange/getDateKey below derive day boundaries from a UTC-midnight-
// anchored booking `date` — using UTC accessors keeps them correct
// regardless of the server process's local timezone (see combineDateAndTimeIST
// in utils/openingHours.ts, used below, for the fuller explanation).
const toDayRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
};

const getDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Reconstruct the embedded OpeningHours object (keyed by day name) from the
// normalized VenueOpeningHour rows so isWithinOpeningHours works unchanged.
const buildOpeningHours = (
  rows: VenueOpeningHour[] | undefined | null,
): OpeningHours | null => {
  if (!rows || rows.length === 0) {
    return null;
  }
  const result: any = {};
  for (const row of rows) {
    result[row.day] = {
      isOpen: row.isOpen,
      openTime: row.openTime,
      closeTime: row.closeTime,
      slots: Array.isArray(row.slots) ? (row.slots as any) : [],
    };
  }
  return result as OpeningHours;
};

const uniqueStrings = (values: Array<string | null | undefined>): string[] =>
  Array.from(
    new Set(values.filter((v): v is string => typeof v === "string" && !!v)),
  );

// Mongoose `.populate()` replaced the String-FK field with the referenced
// document. There is no relation defined for these refs, so we fetch the
// related rows in a single follow-up query and attach them the same way.
const attachRefs = async (
  bookings: BookingDocument[],
  opts: { user?: boolean; venue?: boolean; coach?: boolean },
): Promise<BookingDocument[]> => {
  const [users, venues, coaches] = await Promise.all([
    opts.user
      ? prisma.user.findMany({
          where: { id: { in: uniqueStrings(bookings.map((b) => b.userId)) } },
        })
      : Promise.resolve([]),
    opts.venue
      ? prisma.venue.findMany({
          where: { id: { in: uniqueStrings(bookings.map((b) => b.venueId)) } },
        })
      : Promise.resolve([]),
    opts.coach
      ? prisma.coach.findMany({
          where: { id: { in: uniqueStrings(bookings.map((b) => b.coachId)) } },
        })
      : Promise.resolve([]),
  ]);

  const usersById = new Map(users.map((u) => [u.id, u]));
  const venuesById = new Map(venues.map((v) => [v.id, v]));
  const coachesById = new Map(coaches.map((c) => [c.id, c]));

  return bookings.map((booking) => {
    const augmented: any = { ...booking };
    if (opts.user) {
      augmented.userId = usersById.get(booking.userId) ?? booking.userId;
    }
    if (opts.venue) {
      augmented.venueId = booking.venueId
        ? (venuesById.get(booking.venueId) ?? booking.venueId)
        : booking.venueId;
    }
    if (opts.coach) {
      augmented.coachId = booking.coachId
        ? (coachesById.get(booking.coachId) ?? booking.coachId)
        : booking.coachId;
    }
    return augmented as BookingDocument;
  });
};

const hasConflictingVenueBooking = async (
  venueId: string,
  date: Date,
  startTime: string,
  endTime: string,
  userId?: string | null,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const conflicts = await db.booking.findFirst({
    where: {
      venueId,
      date: {
        gte: start,
        lt: end,
      },
      status: { in: ACTIVE_STATUSES },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        { startTime: { gte: startTime }, endTime: { lte: endTime } },
      ],
    },
  });

  if (conflicts) {
    // If the conflict is an unpaid checkout by the same user, cancel it and ignore the conflict
    if (
      userId &&
      conflicts.userId.toString() === userId &&
      (conflicts.status === "PENDING_CONFIRMATION" ||
        conflicts.status === "PENDING_INVITES") &&
      !conflicts.paymentConfirmedAt
    ) {
      await db.booking.update({
        where: { id: conflicts.id },
        data: {
          status: "CANCELLED",
          cancellationReason:
            "Overwritten by a new booking attempt from the same user",
        },
      });
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
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> => {
  const { start, end } = toDayRange(date);
  const conflicts = await db.booking.findFirst({
    where: {
      coachId,
      date: {
        gte: start,
        lt: end,
      },
      status: { in: ACTIVE_STATUSES },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        { startTime: { gte: startTime }, endTime: { lte: endTime } },
      ],
    },
  });

  if (conflicts) {
    // If the conflict is an unpaid checkout by the same user, cancel it and ignore the conflict
    if (
      userId &&
      conflicts.userId.toString() === userId &&
      (conflicts.status === "PENDING_CONFIRMATION" ||
        conflicts.status === "PENDING_INVITES") &&
      !conflicts.paymentConfirmedAt
    ) {
      await db.booking.update({
        where: { id: conflicts.id },
        data: {
          status: "CANCELLED",
          cancellationReason:
            "Overwritten by a new booking attempt from the same user",
        },
      });
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
  db: Prisma.TransactionClient,
): Promise<void> => {
  if (!isValidId(resourceId)) {
    throw new Error(
      `Invalid resource ID format for ${resourceType}: ${resourceId}`,
    );
  }
  const dateKey = `${getDateKey(date)}-${startTime}`;
  await db.bookingSlotLock.upsert({
    where: {
      unique_booking_slot_lock: {
        resourceType,
        resourceId,
        dateKey,
      },
    },
    create: {
      resourceType,
      resourceId,
      dateKey,
      version: 1,
      lastLockedAt: new Date(),
    },
    update: {
      version: { increment: 1 },
      lastLockedAt: new Date(),
    },
  });
};

const createBookingAtomically = async (
  payload: BookingCreatePayload,
): Promise<BookingDocument> => {
  return prisma.$transaction(async (tx) => {
    if (payload.venueId) {
      await acquireResourceSlotLock(
        "VENUE_SLOT",
        payload.venueId,
        payload.date,
        payload.startTime,
        tx,
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
        tx,
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
        tx,
      );

      const hasCoachConflict = await hasConflictingCoachBooking(
        payload.coachId,
        payload.date,
        payload.startTime,
        payload.endTime,
        payload.userId,
        tx,
      );

      if (hasCoachConflict) {
        throw new Error("Coach is not available for the selected time slot");
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

    const booking = await tx.booking.create({
      data: {
        userId: payload.userId,
        ...(payload.venueId ? { venueId: payload.venueId } : {}),
        ...(payload.coachId ? { coachId: payload.coachId } : {}),
        ...(payload.academyId ? { academyId: payload.academyId } : {}),
        sport: payload.sport,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        totalAmount: toInt(payload.totalAmount),
        serviceFee: toInt(payload.serviceFee),
        taxAmount: toInt(payload.taxAmount),
        ...(payload.promoCode ? { promoCode: payload.promoCode } : {}),
        ...(payload.discountAmount
          ? { discountAmount: toInt(payload.discountAmount) }
          : {}),
        status: "PENDING_CONFIRMATION",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        checkInCode: payload.checkInCode,
        // Awaiting provider confirmation before booking is confirmed
        participantName: payload.participantName,
        participantId: String(payload.participantId),
        ...(payload.participantAge !== undefined
          ? { participantAge: payload.participantAge }
          : {}),
        organizerId: payload.organizerId,
        payments: {
          create: (payload.payments || []).map((p: any) => ({
            userId: String(p.userId),
            userType: p.userType as PaymentUserType,
            amount: toInt(p.amount),
            status: (p.status ?? "PENDING") as PaymentLegStatus,
            ...(p.paidAt ? { paidAt: p.paidAt } : {}),
          })),
        },
      },
      include: bookingChildren,
    });

    return booking;
  });
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
  // No unique constraint matches this lookup, so emulate the old upsert:
  // find the active entry for this exact slot, then update or create.
  const where = {
    userId: payload.userId,
    ...(payload.venueId ? { venueId: payload.venueId } : {}),
    ...(payload.coachId ? { coachId: payload.coachId } : {}),
    date: payload.date,
    startTime: payload.startTime,
    status: "ACTIVE" as const,
  };

  const existing = await prisma.bookingWaitlist.findFirst({ where });

  const data = {
    userId: payload.userId,
    ...(payload.venueId ? { venueId: payload.venueId } : {}),
    ...(payload.coachId ? { coachId: payload.coachId } : {}),
    sport: payload.sport,
    date: payload.date,
    startTime: payload.startTime,
    endTime: payload.endTime,
    alternateSlots: payload.alternateSlots || [],
    status: "ACTIVE" as const,
  };

  if (existing) {
    return prisma.bookingWaitlist.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.bookingWaitlist.create({ data });
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

    const requestedStartAt = combineDateAndTimeIST(
      payload.date,
      normalizedStartTime,
    );
    const requestedEndAt = combineDateAndTimeIST(
      payload.date,
      normalizedEndTime,
    );
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
        userIdIsValid: isValidId(payload.userId),
        venueId: payload.venueId,
        venueIdIsValid: payload.venueId ? isValidId(payload.venueId) : "N/A",
        coachId: payload.coachId,
        coachIdIsValid: payload.coachId ? isValidId(payload.coachId) : "N/A",
        sport: payload.sport,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        dependentId: payload.dependentId,
        dependentIdIsValid: payload.dependentId
          ? isValidId(payload.dependentId)
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
    if (!isValidId(payload.userId)) {
      throw new Error("Invalid user ID format");
    }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      throw new Error("User not found");
    }
    console.log("[initiateBooking] STEP 1 OK: user =", user.id.toString());

    // Clean up any existing abandoned booking for this exact same slot by this user
    // This allows them to "try again" immediately without hitting "Coach/Venue is not available"
    const startOfDay = new Date(
      Date.UTC(
        payload.date.getUTCFullYear(),
        payload.date.getUTCMonth(),
        payload.date.getUTCDate(),
      ),
    );

    const cleanupWhere: any = {
      userId: user.id,
      date: {
        gte: startOfDay,
        lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
      },
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      status: "PENDING_CONFIRMATION",
    };
    if (payload.coachId) cleanupWhere.coachId = payload.coachId;
    if (payload.venueId) cleanupWhere.venueId = payload.venueId;

    const deletedAbandoned = await prisma.booking.deleteMany({
      where: cleanupWhere,
    });
    if (deletedAbandoned.count > 0) {
      console.log(
        `[initiateBooking] Cleaned up ${deletedAbandoned.count} abandoned booking(s) for user ${user.id} attempting to re-book`,
      );
    }

    // Determine participant details
    let participantName = user.name;
    let participantId: string = user.id;
    let participantAge: number | undefined = undefined;

    if (payload.dependentId) {
      console.log(
        "[initiateBooking] STEP 2: validating dependentId =",
        JSON.stringify(payload.dependentId),
      );
      if (payload.dependentId === "undefined" || !isValidId(payload.dependentId)) {
        throw new Error("Invalid dependent ID format");
      }
      // Booking is for a dependent (child)
      const dependent = await prisma.player.findFirst({
        where: {
          id: payload.dependentId,
          userId: user.id,
          type: "DEPENDENT",
        },
      });
      if (!dependent) {
        throw new Error("Dependent not found");
      }

      // Validate dependent's age
      if (typeof dependent.age !== "number" || isNaN(dependent.age)) {
        throw new Error("Invalid age for dependent");
      }

      participantName = dependent.name;
      participantId = dependent.id;
      participantAge = dependent.age;
      console.log(
        "[initiateBooking] STEP 2 OK: dependent =",
        dependent.id.toString(),
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
      participantId = user.id;
      console.log(
        "[initiateBooking] STEP 2: no dependent, participantId =",
        participantId?.toString(),
      );
    }

    let venue:
      | Prisma.VenueGetPayload<{
          include: { sportPricing: true; openingHours: true };
        }>
      | null = null;

    if (payload.venueId) {
      console.log(
        "[initiateBooking] STEP 3: validating venueId =",
        JSON.stringify(payload.venueId),
      );
      if (!isValidId(payload.venueId)) {
        throw new Error("Invalid venue ID format");
      }
      venue = await prisma.venue.findUnique({
        where: { id: payload.venueId },
        include: { sportPricing: true, openingHours: true },
      });
      if (!venue) {
        throw new Error("Venue not found");
      }
      console.log(
        "[initiateBooking] STEP 3 OK: venue =",
        venue.id.toString(),
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
      const openingHours = buildOpeningHours(venue.openingHours);
      if (openingHours) {
        const hoursCheck = isWithinOpeningHours(
          payload.date,
          normalizedStartTime,
          normalizedEndTime,
          openingHours,
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
      const sportPrice = venue.sportPricing.find(
        (sp) => sp.sport === payload.sport,
      )?.price;
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
      if (!isValidId(payload.coachId)) {
        throw new Error("Invalid coach ID format");
      }
      const coach = await prisma.coach.findUnique({
        where: { id: payload.coachId },
        include: {
          sportPricing: true,
          availability: true,
          sportAvailability: true,
        },
      });
      if (!coach) {
        throw new Error("Coach not found");
      }
      console.log(
        "[initiateBooking] STEP 4 OK: coach =",
        coach.id.toString(),
        "userId raw =",
        JSON.stringify(coach.userId),
        "serviceMode:",
        coach.serviceMode,
      );

      if (COACH_SUBSCRIPTIONS_ENFORCE_BOOKING) {
        const now = new Date();

        const subscriptionWhere: any = {
          coachId: coach.id,
          userId: user.id,
          status: { in: ["ACTIVE", "PAST_DUE"] },
        };

        if (payload.dependentId) {
          subscriptionWhere.dependentId = payload.dependentId;
        } else {
          subscriptionWhere.dependentId = null;
        }

        const coachSubscription = await prisma.coachSubscription.findFirst({
          where: subscriptionWhere,
          orderBy: { createdAt: "desc" },
        });

        if (!coachSubscription) {
          throw new Error(
            payload.dependentId
              ? "No active coach subscription found for this dependent"
              : "No active coach subscription found for your account",
          );
        }

        const isActive = coachSubscription.status === "ACTIVE";
        const isPastDueWithinGrace =
          coachSubscription.status === "PAST_DUE" &&
          coachSubscription.gracePeriodEndsAt &&
          coachSubscription.gracePeriodEndsAt > now;

        if (!isActive && !isPastDueWithinGrace) {
          throw new Error(
            payload.dependentId
              ? "No active coach subscription found for this dependent"
              : "No active coach subscription found for your account",
          );
        }
      }

      if (!payload.venueId && !payload.playerLocation) {
        throw new Error("Player location is required for coach booking");
      }

      if (
        (coach.serviceMode === "FREELANCE" || coach.serviceMode === "HYBRID") &&
        payload.playerLocation
      ) {
        const coachBaseCoordinates: [number, number] | undefined =
          coach.baseLng != null && coach.baseLat != null
            ? [coach.baseLng, coach.baseLat]
            : undefined;
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

      const coachSportRate = payload.sport
        ? coach.sportPricing.find((sp) => sp.sport === payload.sport)?.price
        : undefined;
      const effectiveCoachRate =
        typeof coachSportRate === "number" && coachSportRate > 0
          ? coachSportRate
          : coach.hourlyRate;

      coachPrice = hours * effectiveCoachRate;
    }

    let academyPrice = 0;

    if (payload.academyId) {
      if (!isValidId(payload.academyId)) {
        throw new Error("Invalid academy ID format");
      }
      const academy = await prisma.academy.findUnique({
        where: { id: payload.academyId },
      });
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
      const venueOwnerIdStr = venue?.ownerId || undefined;
      let coachUserIdStr: string | undefined;
      if (payload.coachId) {
        const coachInfo = await prisma.coach.findUnique({
          where: { id: payload.coachId },
          select: { userId: true },
        });
        if (coachInfo && coachInfo.userId) {
          coachUserIdStr = coachInfo.userId.toString();
        }
      }

      console.log(
        "[initiateBooking] STEP 5 splits input: venueOwnerIdStr =",
        JSON.stringify(venueOwnerIdStr),
        "venueOwnerIdValid:",
        venueOwnerIdStr ? isValidId(venueOwnerIdStr) : false,
        "coachUserIdStr =",
        JSON.stringify(coachUserIdStr),
        "coachUserIdValid:",
        coachUserIdStr ? isValidId(coachUserIdStr) : false,
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
        .filter((p) => p.userId && isValidId(p.userId))
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
        userIdValid: isValidId(bookingPayload.userId),
        venueId: bookingPayload.venueId,
        coachId: bookingPayload.coachId,
        organizerId: bookingPayload.organizerId,
        organizerIdValid: isValidId(bookingPayload.organizerId),
        participantId: bookingPayload.participantId?.toString(),
        participantIdValid: bookingPayload.participantId
          ? isValidId(bookingPayload.participantId.toString())
          : false,
        paymentsCount: bookingPayload.payments?.length,
        payments: bookingPayload.payments,
      }),
    );

    const booking =
      payload.venueId || payload.coachId || payload.academyId
        ? await createBookingAtomically(bookingPayload)
        : await prisma.booking.create({
            data: {
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
              totalAmount: toInt(bookingPayload.totalAmount),
              serviceFee: toInt(bookingPayload.serviceFee),
              taxAmount: toInt(bookingPayload.taxAmount),
              ...(bookingPayload.promoCode
                ? { promoCode: bookingPayload.promoCode }
                : {}),
              ...(bookingPayload.discountAmount
                ? { discountAmount: toInt(bookingPayload.discountAmount) }
                : {}),
              status: "PENDING_CONFIRMATION",
              expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
              checkInCode: bookingPayload.checkInCode,
              // Awaiting provider confirmation before booking is confirmed
              participantName: bookingPayload.participantName,
              participantId: String(bookingPayload.participantId),
              ...(bookingPayload.participantAge !== undefined
                ? { participantAge: bookingPayload.participantAge }
                : {}),
              organizerId: bookingPayload.organizerId,
              payments: {
                create: (bookingPayload.payments || []).map((p: any) => ({
                  userId: String(p.userId),
                  userType: p.userType as PaymentUserType,
                  amount: toInt(p.amount),
                  status: (p.status ?? "PENDING") as PaymentLegStatus,
                  ...(p.paidAt ? { paidAt: p.paidAt } : {}),
                })),
              },
            },
            include: bookingChildren,
          });

    // Record promo code usage after successful booking
    if (validPromoCode && discountAmount > 0) {
      await applyPromoCode(
        validPromoCode,
        payload.userId,
        booking.id.toString(),
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
  const where = { userId };

  const total = await prisma.booking.count({ where });
  const rows = await prisma.booking.findMany({
    where,
    include: bookingChildren,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });

  const bookings = await attachRefs(rows, { venue: true, coach: true });

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
  const where = {
    venueId,
    status: { in: PROVIDER_LIST_STATUSES },
  };
  const skip = (page - 1) * limit;

  const total = await prisma.booking.count({ where });
  const rows = await prisma.booking.findMany({
    where,
    include: bookingChildren,
    orderBy: { date: "asc" },
    skip,
    take: limit,
  });

  const bookings = await attachRefs(rows, { user: true, coach: true });

  return { bookings, total, page, totalPages: Math.ceil(total / limit) };
};

/**
 * Get bookings for a venue on a specific date (optimized for availability check)
 */
export const getVenueBookingsForDate = async (
  venueId: string,
  date: Date,
): Promise<BookingDocument[]> => {
  // UTC accessors — see toDayRange above / combineDateAndTimeIST for why:
  // `date` is UTC-midnight-anchored and Date#setHours reads/writes in the
  // server process's local timezone.
  const startOfDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  const rows = await prisma.booking.findMany({
    where: {
      venueId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: ACTIVE_STATUSES },
    },
    select: { startTime: true, endTime: true },
  });

  return rows as unknown as BookingDocument[];
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
  const venues = await prisma.venue.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const venueIds = venues.map((v) => v.id);

  const where = {
    venueId: { in: venueIds },
    status: { in: PROVIDER_LIST_STATUSES },
  };
  const skip = (page - 1) * limit;

  // Find all bookings for these venues
  const total = await prisma.booking.count({ where });
  const rows = await prisma.booking.findMany({
    where,
    include: bookingChildren,
    orderBy: { date: "desc" },
    skip,
    take: limit,
  });

  const bookings = await attachRefs(rows, {
    user: true,
    venue: true,
    coach: true,
  });

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
  const coach = await prisma.coach.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (!coach) {
    throw new Error("Coach profile not found");
  }

  const where = {
    coachId: coach.id,
    status: { in: PROVIDER_LIST_STATUSES },
  };
  const skip = (page - 1) * limit;

  const total = await prisma.booking.count({ where });
  const rows = await prisma.booking.findMany({
    where,
    include: bookingChildren,
    orderBy: { date: "desc" },
    skip,
    take: limit,
  });

  const bookings = await attachRefs(rows, {
    user: true,
    venue: true,
    coach: true,
  });

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
  Array<{ name: string; email: string; role: "Player" | "PROVIDER" }>
> => {
  const recipients: Array<{
    name: string;
    email: string;
    role: "Player" | "PROVIDER";
  }> = [];

  const player = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { name: true, email: true },
  });
  if (player?.email) {
    recipients.push({
      name: player.name || "Player",
      email: player.email,
      role: "Player",
    });
  }

  if (booking.coachId) {
    const coach = await prisma.coach.findUnique({
      where: { id: booking.coachId },
      select: { userId: true },
    });
    const coachUser = coach?.userId
      ? await prisma.user.findUnique({
          where: { id: coach.userId },
          select: { name: true, email: true },
        })
      : null;
    if (coachUser?.email) {
      recipients.push({
        name: coachUser.name || "Coach",
        email: coachUser.email,
        role: "PROVIDER",
      });
    }
  }

  if (booking.venueId) {
    const venue = await prisma.venue.findUnique({
      where: { id: booking.venueId },
      select: { ownerId: true },
    });
    const venueOwner = venue?.ownerId
      ? await prisma.user.findUnique({
          where: { id: venue.ownerId },
          select: { name: true, email: true },
        })
      : null;
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
    { name: string; email: string; role: "Player" | "PROVIDER" }
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
  const venueRow = booking.venueId
    ? await prisma.venue.findUnique({
        where: { id: booking.venueId },
        select: { name: true },
      })
    : null;
  const venueName = venueRow?.name || "Venue";

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
          recipient.role === "Player"
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
      (payment) => payment.userType === "Player" && payment.status === "PAID",
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

  let hasPending = false;
  let totalRefundPaise = 0;
  let skippedRefundPaise = 0;

  for (const target of targets) {
    // Accept PENDING transactions too — payment may still be settling at PhonePe
    // when the user cancels immediately after paying. The retry job picks these up.
    const transaction = await prisma.bookingPaymentTransaction.findFirst({
      where: {
        bookingId: booking.id,
        userId: target.userId,
        status: { in: ["COMPLETED", "PENDING"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!transaction) {
      // No payment record at all — defer to retry job rather than hard-fail.
      hasPending = true;
      continue;
    }

    // Payment still settling — defer, retry job will attempt once it's COMPLETED.
    if (transaction.status !== "COMPLETED") {
      hasPending = true;
      skippedRefundPaise += target.amountPaise;
      continue;
    }

    // Skip already-initiated or completed refunds — allow FAILED to be retried.
    if (transaction.refundState && transaction.refundState !== "FAILED") {
      hasPending = transaction.refundState !== "COMPLETED";
      skippedRefundPaise += transaction.refundAmount || target.amountPaise;
      continue;
    }

    const refundMerchantId = `rf_${Date.now()}_${randomBytes(4).toString("hex")}`;
    try {
      const refundResponse = await initiatePhonePeRefund({
        merchantRefundId: refundMerchantId,
        originalMerchantOrderId: transaction.merchantOrderId,
        amount: target.amountPaise / 100, // initiatePhonePeRefund expects rupees
      });
      const refundState = refundResponse.state || "INITIATED";
      const refundId = refundResponse.refundId ?? transaction.refundId;

      await prisma.bookingPaymentTransaction.update({
        where: { id: transaction.id },
        data: {
          refundMerchantId,
          ...(refundId ? { refundId } : {}),
          refundState,
          refundAmount: target.amountPaise,
          refundResponse: refundResponse.raw as any,
        },
      });

      totalRefundPaise += target.amountPaise;

      // FAILED or INITIATED both stay PENDING — polling/retry job closes the loop.
      if (refundState !== "COMPLETED") hasPending = true;
    } catch (err) {
      // PhonePe threw — record the attempt and defer. Never hard-reject here.
      await prisma.bookingPaymentTransaction.update({
        where: { id: transaction.id },
        data: {
          refundMerchantId,
          refundState: "FAILED",
          refundAmount: target.amountPaise,
        },
      });
      hasPending = true;
      totalRefundPaise += target.amountPaise;
      console.error(
        `[initiateBookingRefunds] PhonePe call failed for booking ${booking.id}, will retry:`,
        err,
      );
    }
  }

  // No transactions processed (all deferred) — stay PENDING for retry job.
  if (totalRefundPaise === 0) {
    return {
      refundStatus: "PENDING",
      refundAmount:
        skippedRefundPaise > 0
          ? skippedRefundPaise / 100
          : (booking.refundAmount ??
            Math.round((booking.totalAmount * refundPercentage) / 100)),
    };
  }

  return {
    refundStatus: hasPending ? "PENDING" : "PROCESSED",
    refundAmount: Math.round(totalRefundPaise + skippedRefundPaise) / 100,
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
  let booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.refundStatus === "PROCESSED") {
    throw new Error("Refund already processed for this booking");
  }

  // Only block if there is actually an in-flight PhonePe refund (INITIATED on the
  // transaction). A booking can be PENDING with no submitted refund — e.g. the
  // initial attempt failed transiently — and in that case the admin should be
  // able to re-trigger it or switch method (Store Credit / Bank Transfer).
  if (booking.refundStatus === "PENDING") {
    const inFlight = await prisma.bookingPaymentTransaction.findFirst({
      where: {
        bookingId: booking.id,
        refundState: "INITIATED",
      },
      select: { id: true },
    });
    if (inFlight) {
      throw new Error(
        "Refund already submitted to PhonePe and is awaiting confirmation. No further action needed.",
      );
    }
  }

  let refundResult: {
    refundStatus: "PENDING" | "PROCESSED" | "REJECTED";
    refundAmount: number;
  };
  try {
    refundResult = await initiateBookingRefunds(
      booking,
      refundPercentage,
      reason,
    );
  } catch (error) {
    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { refundStatus: "REJECTED" },
      include: bookingChildren,
    });
    throw error;
  }

  booking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      ...(refundResult.refundAmount > 0
        ? { refundAmount: toInt(refundResult.refundAmount) }
        : {}),
      refundStatus: refundResult.refundStatus,
    },
    include: bookingChildren,
  });

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
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, refundStatus: true, refundAmount: true },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  // TODO(prisma): the old query filtered `refundResponse.method != BANK_TRANSFER`
  // as a nested-JSON condition inside Mongo. Prisma JSON `not` filters do not
  // reliably exclude rows where the key is absent, so we fetch by refundMerchantId
  // and drop BANK_TRANSFER rows in-code, which matches the original intent.
  const refundableTransactions = (
    await prisma.bookingPaymentTransaction.findMany({
      where: {
        bookingId,
        refundMerchantId: { not: null },
      },
      orderBy: { createdAt: "desc" },
    })
  ).filter((t) => (t.refundResponse as any)?.method !== "BANK_TRANSFER");

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

    await prisma.bookingPaymentTransaction.update({
      where: { id: transaction.id },
      data: {
        ...(refundId ? { refundId } : {}),
        refundState: latestState,
        refundAmount: toInt(latestAmount),
        refundResponse: refundStatus.raw as any,
      },
    });

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

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      refundStatus: aggregateRefundStatus,
      refundAmount: toInt(Math.round(totalRefundPaise) / 100),
    },
  });

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
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      organizerId: requesterId,
      status: { in: ACTIVE_STATUSES },
    },
    include: bookingChildren,
  });

  if (!booking) {
    throw new Error("Booking not found or already cancelled");
  }

  // Calculate booking start time (UTC-safe — see combineDateAndTimeIST)
  const bookingStartTime = combineDateAndTimeIST(
    booking.date,
    booking.startTime,
  );

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

  // Update booking status — conditional (only if still in an active status),
  // mirroring findOneAndUpdate({new:true}): null when nothing matched.
  const cancelResult = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      organizerId: requesterId,
      status: { in: ACTIVE_STATUSES },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: cancellationReason || "Cancelled by user",
      refundAmount: toInt(refundAmount),
      // Don't pre-set refundStatus here — PhonePe hasn't been called yet.
      // initiateBookingRefunds sets the real status (PENDING/PROCESSED/REJECTED)
      // after the gateway responds; the catch block sets REJECTED on failure.
    },
  });

  let updatedBooking =
    cancelResult.count > 0
      ? await prisma.booking.findUnique({
          where: { id: bookingId },
          include: bookingChildren,
        })
      : null;

  // Send cancellation notifications to all participants
  if (updatedBooking) {
    const venue = updatedBooking.venueId
      ? await prisma.venue.findUnique({ where: { id: updatedBooking.venueId } })
      : null;

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
            bookingId: updatedBooking.id.toString(),
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
            bookingId: updatedBooking.id.toString(),
            status: "CANCELLED",
            date: updatedBooking.date.toISOString(),
            startTime: updatedBooking.startTime,
            endTime: updatedBooking.endTime,
          },
        }).catch(() => {});
      }
    }

    // Cancel all pending reminders for this booking
    ScheduledNotificationService.cancelBookingReminders(
      updatedBooking.id,
    ).catch((err: Error) =>
      console.error(
        `Failed to cancel booking reminders for ${updatedBooking?.id}:`,
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
        updatedBooking = await prisma.booking.update({
          where: { id: updatedBooking.id },
          data: {
            refundStatus: refundResult.refundStatus,
            refundAmount: toInt(refundResult.refundAmount),
          },
          include: bookingChildren,
        });
        // Notify the organizer only after the refund has actually been initiated
        NotificationService.send({
          userId: updatedBooking.organizerId.toString(),
          type: "PAYMENT_REFUND",
          title: "Refund Initiated",
          message: `A ${refundPercentage}% refund of ₹${refundAmount} has been initiated for your cancelled booking${venue ? ` at ${venue.name}` : ""}.`,
          data: {
            bookingId: updatedBooking.id.toString(),
            ...(venue ? { venueName: venue.name } : {}),
            sport: updatedBooking.sport,
            refundAmount,
            refundPercentage,
            cancellationReason: cancellationReason || "Cancelled by user",
          },
        }).catch((err: Error) =>
          console.error(`Failed to send refund notification:`, err),
        );
      } catch (refundError) {
        console.error(
          `Failed to initiate refund for booking ${updatedBooking.id.toString()}:`,
          refundError,
        );
        // Keep as PENDING so the retry job can attempt it — never auto-reject.
        updatedBooking = await prisma.booking
          .update({
            where: { id: updatedBooking.id },
            data: { refundStatus: "PENDING" },
            include: bookingChildren,
          })
          .catch(() => updatedBooking);
      }
    }

    if (updatedBooking) {
      await sendBookingLifecycleEmails(updatedBooking, "CANCELLED", {
        cancellationReason: cancellationReason || "Cancelled by user",
        refundAmount,
        refundPercentage,
      });

      // A slot just freed up — alert anyone on the waitlist (fire-and-forget).
      void notifyWaitlistForFreedSlot(updatedBooking);
    }
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

  const booking = await prisma.booking.findFirst({
    where: { checkInCode: normalizedCode },
    include: bookingChildren,
  });

  if (!booking) {
    throw new Error("Invalid check-in code");
  }

  if (booking.status !== "CONFIRMED") {
    throw new Error(`Cannot check-in. Booking status is ${booking.status}`);
  }

  // Verify authorization (admin, venue owner, or assigned coach)
  if (requesterRole !== "Admin") {
    let isAuthorized = false;

    if (requesterRole === "Coach" && booking.coachId) {
      const coach = await prisma.coach.findUnique({
        where: { id: booking.coachId },
        select: { userId: true },
      });
      if (coach?.userId?.toString() === requesterUserId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && booking.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: booking.venueId },
        select: { ownerId: true },
      });
      if (venue?.ownerId?.toString() === requesterUserId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error("Unauthorized to check in this booking");
    }
  }

  const now = new Date();
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

  // UTC-safe — see combineDateAndTimeIST
  const bookingDateTime = combineDateAndTimeIST(booking.date, booking.startTime);

  // Check-in window: 15 minutes before start time
  const checkInWindow = new Date(bookingDateTime.getTime() - 15 * 60 * 1000);
  if (now < checkInWindow) {
    throw new Error(
      "Check-in not yet available. You can check in 15 minutes before the booking starts.",
    );
  }

  // Check-in code expiration: exactly at booking end time
  const bookingEndDateTime = combineDateAndTimeIST(booking.date, booking.endTime);

  if (now > bookingEndDateTime) {
    throw new Error(
      "Check-in code has expired. Check-in is allowed only till the booking end time.",
    );
  }

  const updateResult = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      status: "CONFIRMED",
    },
    data: { status: "IN_PROGRESS" },
  });

  const updatedBooking =
    updateResult.count > 0
      ? await prisma.booking.findUnique({
          where: { id: booking.id },
          include: bookingChildren,
        })
      : null;

  if (!updatedBooking) {
    throw new Error("Cannot check-in. Booking status changed, please retry");
  }

  NotificationService.send({
    userId: updatedBooking.userId.toString(),
    type: "BOOKING_STATUS_UPDATED",
    title: "Booking checked in",
    message: `Your booking is now IN_PROGRESS for ${updatedBooking.sport}.`,
    data: {
      bookingId: updatedBooking.id.toString(),
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
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: { availability: true, sportAvailability: true },
  });
  if (!coach) return false;

  const dayOfWeek = date.getUTCDay(); // date is UTC-midnight-anchored — see combineDateAndTimeIST

  // Resolve slots: prefer sport-specific availability, fall back to generic
  // availability. availabilityBySport is now the normalized CoachSportAvailability
  // rows filtered by sport.
  const sportSlots = sport
    ? coach.sportAvailability
        .filter((sa) => sa.sport === sport)
        .map((sa) => ({
          dayOfWeek: sa.dayOfWeek,
          startTime: sa.startTime,
          endTime: sa.endTime,
        }))
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
  const { start: dayStart, end: dayEnd } = toDayRange(date);
  const existingBooking = await prisma.booking.findFirst({
    where: {
      coachId,
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
      status: { in: ACTIVE_STATUSES },
      OR: [
        { startTime: { lte: startTime }, endTime: { gt: startTime } },
        { startTime: { lt: endTime }, endTime: { gte: endTime } },
        { startTime: { gte: startTime }, endTime: { lte: endTime } },
      ],
    },
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
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.userId.toString() !== userId) {
    throw new Error("Unauthorized to confirm this booking");
  }

  if (booking.status === "CANCELLED") {
    throw new Error("Cannot confirm payment for a cancelled booking");
  }

  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      userId,
      status: { not: "CANCELLED" },
      paymentConfirmedAt: null,
    },
    data: { paymentConfirmedAt: new Date() },
  });

  const emailClaim = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      userId,
      status: { in: ["PENDING_CONFIRMATION", "CONFIRMED"] },
      confirmationEmailSentAt: null,
    },
    data: { confirmationEmailSentAt: new Date() },
  });

  const emailClaimedBooking =
    emailClaim.count > 0
      ? await prisma.booking.findUnique({
          where: { id: bookingId },
          include: bookingChildren,
        })
      : null;

  if (emailClaimedBooking) {
    await sendBookingLifecycleEmails(
      emailClaimedBooking,
      emailClaimedBooking.status === "CONFIRMED"
        ? "CONFIRMED"
        : "PENDING_CONFIRMATION",
    );
  }

  const updatedBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });
  if (!updatedBooking) {
    throw new Error("Booking not found");
  }

  // Send payment confirmation notification
  const venue = updatedBooking.venueId
    ? await prisma.venue.findUnique({
        where: { id: updatedBooking.venueId },
        select: { name: true },
      })
    : null;
  NotificationService.send({
    userId: userId,
    type: "PAYMENT_CONFIRMED",
    title: "Payment Confirmed",
    message: `Your payment for ${updatedBooking.sport} at ${venue?.name || "the venue"} has been confirmed!`,
    data: {
      bookingId: updatedBooking.id.toString(),
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
        bookingId: updatedBooking.id.toString(),
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
      bookingId: updatedBooking.id.toString(),
      status: updatedBooking.status,
      date: updatedBooking.date.toISOString(),
      startTime: updatedBooking.startTime,
      endTime: updatedBooking.endTime,
    },
  }).catch(() => {});

  // Create booking reminders
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reminderPreferences: true, notificationPreferences: true },
  });
  const reminderPreferences = (user?.reminderPreferences as any) || undefined;
  const notificationPreferences =
    (user?.notificationPreferences as any) || undefined;
  if (user && reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: updatedBooking.id,
        userId: updatedBooking.userId,
        bookingDate: updatedBooking.date,
        startTime: updatedBooking.startTime,
        endTime: updatedBooking.endTime,
        sport: updatedBooking.sport,
        venueName: venue?.name,
        coachName: undefined,
      },
      reminderPreferences.bookingReminders,
      {
        email: notificationPreferences?.email?.bookingReminders ?? true,
        push: notificationPreferences?.push?.bookingReminders ?? true,
        inApp: notificationPreferences?.inApp?.bookingReminders ?? true,
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
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });

  if (!booking) {
    return;
  }

  const emailClaim = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      confirmationEmailSentAt: null,
    },
    data: { confirmationEmailSentAt: new Date() },
  });

  const emailClaimedBooking =
    emailClaim.count > 0
      ? await prisma.booking.findUnique({
          where: { id: bookingId },
          include: bookingChildren,
        })
      : null;

  if (emailClaimedBooking) {
    await sendBookingLifecycleEmails(
      emailClaimedBooking,
      emailClaimedBooking.status === "CONFIRMED"
        ? "CONFIRMED"
        : "PENDING_CONFIRMATION",
    );
  }

  const venue = booking.venueId
    ? await prisma.venue.findUnique({
        where: { id: booking.venueId },
        select: { name: true },
      })
    : null;
  NotificationService.send({
    userId: booking.userId.toString(),
    type: "PAYMENT_CONFIRMED",
    title: "Payment Confirmed",
    message: `Your payment for ${booking.sport} at ${venue?.name || "the venue"} has been confirmed!`,
    data: {
      bookingId: booking.id.toString(),
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
        bookingId: booking.id.toString(),
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
      bookingId: booking.id.toString(),
      status: booking.status,
      date: booking.date.toISOString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
    },
  }).catch(() => {});

  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { reminderPreferences: true, notificationPreferences: true },
  });
  const reminderPreferences = (user?.reminderPreferences as any) || undefined;
  const notificationPreferences =
    (user?.notificationPreferences as any) || undefined;
  if (user && reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: booking.id,
        userId: booking.userId,
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        sport: booking.sport,
        venueName: venue?.name,
        coachName: undefined,
      },
      reminderPreferences.bookingReminders,
      {
        email: notificationPreferences?.email?.bookingReminders ?? true,
        push: notificationPreferences?.push?.bookingReminders ?? true,
        inApp: notificationPreferences?.inApp?.bookingReminders ?? true,
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
  tx?: Prisma.TransactionClient,
): Promise<BookingDocument> => {
  const db = tx ?? prisma;

  const booking: any = await db.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  const wasPaymentConfirmed = Boolean(booking.paymentConfirmedAt);

  if (booking.payments && booking.payments.length > 0) {
    // Mutate the in-memory shape (preserves the return payload) and persist the
    // matching payment leg(s).
    booking.payments = booking.payments.map((payment: any) => {
      if (payment.userId.toString() !== payerUserId) {
        return payment;
      }
      return {
        ...payment,
        status,
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      };
    });

    await db.bookingPaymentLeg.updateMany({
      where: { bookingId, userId: payerUserId },
      data: {
        status: status as PaymentLegStatus,
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      },
    });
  }

  // Set paymentConfirmedAt when all PLAYER entries are PAID.
  // VENUE_LISTER/COACH entries represent payee splits (payout tracking)
  // and are released by the scheduled payout job, not by the player paying.
  if (
    status === "PAID" &&
    (!booking.payments.length ||
      booking.payments
        .filter((payment: any) => payment.userType === "Player")
        .every((payment: any) => payment.status === "PAID"))
  ) {
    booking.paymentConfirmedAt = new Date();
    await db.booking.update({
      where: { id: bookingId },
      data: { paymentConfirmedAt: booking.paymentConfirmedAt },
    });
  }

  if (status === "PAID" && booking.paymentConfirmedAt && !wasPaymentConfirmed) {
    await sendBookingPaymentConfirmation(bookingId);
  }

  // Send payment status notification and delete booking if failed
  if (status === "FAILED") {
    // Automatically delete the booking if payment fails
    // This removes unpaid bookings from showing up for coaches/venues/players
    // (payment legs / participants cascade on delete).
    await db.booking.delete({ where: { id: booking.id } });

    const venue = booking.venueId
      ? await prisma.venue.findUnique({
          where: { id: booking.venueId },
          select: { name: true },
        })
      : null;
    NotificationService.send({
      userId: payerUserId,
      type: "PAYMENT_FAILED",
      title: "Payment Failed",
      message: `Your payment for ${booking.sport} at ${venue?.name || "the venue"} has failed. Please try again.`,
      data: {
        bookingId: booking.id.toString(),
        venueName: venue?.name || "Venue",
        sport: booking.sport,
        date: booking.date.toISOString(),
        startTime: booking.startTime,
        endTime: booking.endTime,
        amount:
          booking.payments.find(
            (p: any) => p.userId.toString() === payerUserId,
          )?.amount || 0,
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
        const friendUser = await prisma.user.findUnique({
          where: { id: friendId },
        });
        throw new Error(`${friendUser?.name || "User"} is not your friend`);
      }
    }

    // Fetch invitee details
    const invitees = await prisma.user.findMany({
      where: {
        id: { in: payload.invitedFriendIds },
        role: "Player",
      },
    });

    if (invitees.length !== payload.invitedFriendIds.length) {
      throw new Error("Some invited users are not valid players");
    }

    // Create the base booking using the standard flow
    const baseBookingResult = await initiateBooking(payload);
    const booking: any = baseBookingResult.booking;

    // Add organizer as first participant (auto-accepted)
    const organizer = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!organizer) {
      throw new Error("Organizer not found");
    }

    // Calculate payment splits if split payment
    let newPaymentLegs: any[] | null = null;
    if (payload.paymentType === "SPLIT") {
      // Get venue and coach info for payments
      let venueOwnerId: string | undefined;
      let venuePrice = 0;
      let coachUserId: string | undefined;
      let coachPrice = 0;

      if (booking.venueId) {
        const venue = await prisma.venue.findUnique({
          where: { id: booking.venueId },
        });
        if (venue && venue.ownerId) {
          venueOwnerId = venue.ownerId;
          // Calculate venue price from booking
          const subtotal =
            booking.totalAmount -
            (booking.serviceFee || 0) -
            (booking.taxAmount || 0) +
            (booking.discountAmount || 0);
          if (booking.coachId) {
            const coach = await prisma.coach.findUnique({
              where: { id: booking.coachId },
            });
            if (coach && coach.userId) {
              coachUserId = coach.userId;
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

        newPaymentLegs = paymentSplits.map((payment) => ({
          userId: payment.userId,
          userType: payment.userType,
          amount: payment.amount,
          status: payment.status,
        }));
      }
    }

    // Estimated per-invitee amount (used in invitations + emails)
    const estimatedAmount =
      payload.paymentType === "SPLIT"
        ? Math.round(booking.totalAmount / (invitees.length + 1))
        : 0;

    // Persist the conversion to a group booking + participants + split legs +
    // invitations atomically.
    const insertedInvitations = await prisma.$transaction(async (txn) => {
      await txn.booking.update({
        where: { id: booking.id },
        data: {
          bookingType: "GROUP",
          organizerId: payload.userId,
          paymentType: payload.paymentType,
          splitMethod: "EQUAL",
          status: "PENDING_INVITES",
        },
      });

      // Add organizer as first participant (auto-accepted)
      await txn.bookingParticipant.create({
        data: {
          bookingId: booking.id,
          userId: payload.userId,
          name: organizer.name,
          status: "ACCEPTED",
          invitedAt: new Date(),
          respondedAt: new Date(),
        },
      });

      // Add invited friends as participants
      for (const invitee of invitees) {
        await txn.bookingParticipant.create({
          data: {
            bookingId: booking.id,
            userId: invitee.id,
            name: invitee.name,
            status: "INVITED",
            invitedAt: new Date(),
          },
        });
      }

      if (newPaymentLegs) {
        await txn.bookingPaymentLeg.deleteMany({
          where: { bookingId: booking.id },
        });
        await txn.bookingPaymentLeg.createMany({
          data: newPaymentLegs.map((p) => ({
            bookingId: booking.id,
            userId: p.userId,
            userType: p.userType as PaymentUserType,
            amount: toInt(p.amount),
            status: (p.status ?? "PENDING") as PaymentLegStatus,
          })),
        });
      }

      // Create booking invitations
      const created = [];
      for (const invitee of invitees) {
        const invitation = await txn.bookingInvitation.create({
          data: {
            bookingId: booking.id,
            inviterId: payload.userId,
            inviteeId: invitee.id,
            venueId: booking.venueId ?? "",
            ...(booking.coachId ? { coachId: booking.coachId } : {}),
            sport: booking.sport,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            estimatedAmount,
            status: "PENDING",
          },
        });
        created.push(invitation);
      }
      return created;
    });

    // Reflect the group conversion on the in-memory object.
    booking.bookingType = "GROUP";
    booking.organizerId = payload.userId;
    booking.paymentType = payload.paymentType;
    booking.splitMethod = "EQUAL";
    booking.status = "PENDING_INVITES";

    // Send invitation emails/notifications
    const venue = booking.venueId
      ? await prisma.venue.findUnique({ where: { id: booking.venueId } })
      : null;
    const inviter = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (venue && inviter) {
      // Send emails to all invitees (async, don't wait)
      for (const invitee of invitees) {
        const invitation = insertedInvitations.find(
          (inv) => inv.inviteeId.toString() === invitee.id.toString(),
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
            userId: invitee.id.toString(),
            type: "BOOKING_INVITATION",
            title: "New Booking Invitation",
            message: `${inviter.name} invited you to play ${booking.sport} at ${venue.name}`,
            data: {
              bookingId: booking.id.toString(),
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
              `Failed to send booking invitation notification to ${invitee.id}:`,
              err,
            ),
          );
        }
      }
    }

    const finalBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: bookingChildren,
    });

    return { booking: finalBooking as BookingDocument };
  } catch (error) {
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
  try {
    const result = await prisma.$transaction(async (txn) => {
      const invitation = await txn.bookingInvitation.findUnique({
        where: { id: invitationId },
      });

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
      await txn.bookingInvitation.update({
        where: { id: invitationId },
        data: {
          status: accept ? "ACCEPTED" : "DECLINED",
          respondedAt: new Date(),
        },
      });

      // Update booking participant status
      const booking: any = await txn.booking.findUnique({
        where: { id: invitation.bookingId },
        include: bookingChildren,
      });
      if (!booking) {
        throw new Error("Booking not found");
      }

      const participant = booking.participants.find(
        (p: any) => p.userId.toString() === userId,
      );

      if (!participant) {
        throw new Error("Participant not found in booking");
      }

      await txn.bookingParticipant.update({
        where: { id: participant.id },
        data: {
          status: accept ? "ACCEPTED" : "DECLINED",
          respondedAt: new Date(),
        },
      });
      participant.status = accept ? "ACCEPTED" : "DECLINED";
      participant.respondedAt = new Date();

      // If declined and payment is split, recalculate payments
      if (!accept && booking.paymentType === "SPLIT") {
        // Remove this user's payment
        booking.payments = booking.payments.filter(
          (p: any) => p.userId.toString() !== userId || p.userType !== "Player",
        );

        // Recalculate split among remaining accepted participants
        const acceptedParticipants = booking.participants.filter(
          (p: any) => p.status === "ACCEPTED",
        );

        if (acceptedParticipants.length > 0) {
          const playerPayments = booking.payments.filter(
            (p: any) => p.userType === "Player",
          );
          const totalPlayerAmount = playerPayments.reduce(
            (sum: number, p: any) => sum + p.amount,
            0,
          );

          // Redistribute total among accepted participants
          const amountPerPerson =
            Math.round((totalPlayerAmount / acceptedParticipants.length) * 100) /
            100;
          const sumOfSplits =
            amountPerPerson * (acceptedParticipants.length - 1);
          const lastPersonAmount =
            Math.round((totalPlayerAmount - sumOfSplits) * 100) / 100;

          // Update player payments
          const nonPlayerPayments = booking.payments.filter(
            (p: any) => p.userType !== "Player",
          );
          booking.payments = [
            ...nonPlayerPayments,
            ...acceptedParticipants.map((p: any, index: number) => ({
              userId: p.userId,
              userType: "Player" as const,
              amount:
                index === acceptedParticipants.length - 1
                  ? lastPersonAmount
                  : amountPerPerson,
              status: "PENDING" as const,
            })),
          ];
        }

        // Persist the recomputed legs.
        await txn.bookingPaymentLeg.deleteMany({
          where: { bookingId: booking.id },
        });
        if (booking.payments.length > 0) {
          await txn.bookingPaymentLeg.createMany({
            data: booking.payments.map((p: any) => ({
              bookingId: booking.id,
              userId: p.userId,
              userType: p.userType as PaymentUserType,
              amount: toInt(p.amount),
              status: (p.status ?? "PENDING") as PaymentLegStatus,
              ...(p.paidAt ? { paidAt: p.paidAt } : {}),
            })),
          });
        }
      }

      // Check if all invitations have been responded to
      const allInvitations = await txn.bookingInvitation.findMany({
        where: { bookingId: booking.id },
      });

      const allResponded = allInvitations.every(
        (inv: any) => inv.status !== "PENDING",
      );

      const anyAccepted = booking.participants.some(
        (p: any) =>
          p.status === "ACCEPTED" &&
          p.userId.toString() !== booking.organizerId.toString(),
      );

      // Update booking status if all have responded
      const bookingUpdate: any = {};
      if (allResponded) {
        if (anyAccepted || booking.participants.length === 1) {
          // At least one person accepted, or organizer booking alone after declines
          booking.status = "PENDING_CONFIRMATION";
          bookingUpdate.status = "PENDING_CONFIRMATION";
        } else {
          // Everyone declined
          booking.status = "CANCELLED";
          booking.cancelledAt = new Date();
          booking.cancellationReason = "All invitations declined";
          bookingUpdate.status = "CANCELLED";
          bookingUpdate.cancelledAt = booking.cancelledAt;
          bookingUpdate.cancellationReason = booking.cancellationReason;
        }
      }

      if (Object.keys(bookingUpdate).length > 0) {
        await txn.booking.update({
          where: { id: booking.id },
          data: bookingUpdate,
        });
      }

      return booking as BookingDocument;
    });

    const booking = result;

    // Send notifications after successful transaction
    const invitee = await prisma.user.findUnique({ where: { id: userId } });
    const organizer = await prisma.user.findUnique({
      where: { id: booking.organizerId },
    });
    const venue = booking.venueId
      ? await prisma.venue.findUnique({ where: { id: booking.venueId } })
      : null;

    if (accept && invitee && organizer && venue) {
      // Notify organizer that someone accepted
      NotificationService.send({
        userId: booking.organizerId.toString(),
        type: "BOOKING_CONFIRMED",
        title: "Booking Invitation Accepted",
        message: `${invitee.name} accepted your invitation to play ${booking.sport} at ${venue.name}`,
        data: {
          bookingId: booking.id.toString(),
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
          const participantUser = await prisma.user.findUnique({
            where: { id: participant.userId },
          });
          if (participantUser) {
            NotificationService.send({
              userId: participant.userId.toString(),
              type: "BOOKING_STATUS_UPDATED",
              title: "Booking awaiting confirmation",
              message: `Your booking for ${booking.sport} at ${venue.name} is awaiting provider confirmation.`,
              data: {
                bookingId: booking.id.toString(),
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
      prisma.coach
        .findUnique({
          where: { id: booking.coachId },
          select: { userId: true },
        })
        .then((coach) => coach?.userId?.toString() === providerUserId),
    );
  }

  if (booking.venueId) {
    checks.push(
      prisma.venue
        .findUnique({
          where: { id: booking.venueId },
          select: { ownerId: true },
        })
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
  let booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });

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

  booking = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED" },
    include: bookingChildren,
  });

  const venue = booking.venueId
    ? await prisma.venue.findUnique({
        where: { id: booking.venueId },
        select: { name: true },
      })
    : null;
  const participantIds = getBookingParticipantIds(booking);

  for (const participantId of participantIds) {
    NotificationService.send({
      userId: participantId,
      type: "BOOKING_CONFIRMED",
      title: "Booking confirmed",
      message: `Your booking for ${booking.sport} at ${venue?.name || "the venue"} is confirmed.`,
      data: {
        bookingId: booking.id.toString(),
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

  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { reminderPreferences: true, notificationPreferences: true },
  });
  const reminderPreferences = (user?.reminderPreferences as any) || undefined;
  const notificationPreferences =
    (user?.notificationPreferences as any) || undefined;
  if (user && reminderPreferences?.bookingReminders?.enabled) {
    ScheduledNotificationService.createBookingReminders(
      {
        bookingId: booking.id,
        userId: booking.userId,
        bookingDate: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        sport: booking.sport,
        venueName: venue?.name,
        coachName: undefined,
      },
      reminderPreferences.bookingReminders,
      {
        email: notificationPreferences?.email?.bookingReminders ?? true,
        push: notificationPreferences?.push?.bookingReminders ?? true,
        inApp: notificationPreferences?.inApp?.bookingReminders ?? true,
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
  if (!isValidId(bookingId)) {
    throw new Error("Invalid booking ID");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });
  if (!booking) throw new Error("Booking not found");

  if (booking.status !== "CONFIRMED") {
    throw new Error("Only confirmed bookings can be rescheduled");
  }

  // Verify the requesting user is actually the assigned coach
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  if (!booking.coachId || booking.coachId.toString() !== coach.id.toString()) {
    throw new Error("Not authorized to reschedule this booking");
  }

  // Check that the new slot doesn't conflict with another booking
  const conflict = await prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      coachId: coach.id,
      date: newDate,
      status: {
        in: ["CONFIRMED", "IN_PROGRESS", "PENDING_CONFIRMATION"],
      },
      startTime: { lt: newEndTime },
      endTime: { gt: newStartTime },
    },
  });

  if (conflict) {
    throw new Error(
      "The requested time slot conflicts with an existing booking",
    );
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
    },
    include: bookingChildren,
  });

  return updatedBooking;
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
  let booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });

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

  const cancellationReason = reason || "Rejected by provider";
  booking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason,
    },
    include: bookingChildren,
  });

  let refundAmount = 0;
  let refundStatus: "PENDING" | "PROCESSED" | "REJECTED" | undefined;
  if (booking.paymentConfirmedAt) {
    try {
      const refund = await processBookingRefund(
        bookingId,
        100,
        booking.cancellationReason || cancellationReason,
      );
      refundAmount = refund.refundAmount;
      refundStatus = refund.refundStatus;
    } catch (error) {
      console.error("Failed to process provider rejection refund:", error);
    }
  }

  const venue = booking.venueId
    ? await prisma.venue.findUnique({
        where: { id: booking.venueId },
        select: { name: true },
      })
    : null;
  const participantIds = getBookingParticipantIds(booking);

  for (const participantId of participantIds) {
    NotificationService.send({
      userId: participantId,
      type: "BOOKING_CANCELLED",
      title: "Booking declined",
      message: `Your booking for ${booking.sport} at ${venue?.name || "the venue"} was declined by the provider.`,
      data: {
        bookingId: booking.id.toString(),
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

  ScheduledNotificationService.cancelBookingReminders(booking.id).catch(
    () => {},
  );

  await sendBookingLifecycleEmails(booking, "CANCELLED", {
    cancellationReason: booking.cancellationReason || cancellationReason,
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
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingChildren,
  });

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
    (p) => p.userType === "Player" && p.status === "PENDING",
  );

  if (unpaidPlayerPayments.length === 0) {
    throw new Error("No unpaid shares to cover");
  }

  // Store user IDs for notifications
  const coveredUserIds = unpaidPlayerPayments.map((p) => p.userId.toString());

  // Calculate total unpaid amount
  const totalUnpaid = unpaidPlayerPayments.reduce((sum, p) => sum + p.amount, 0);

  // Find organizer's payment
  const organizerPayment = booking.payments.find(
    (p) => p.userId.toString() === organizerId && p.userType === "Player",
  );

  await prisma.$transaction(async (txn) => {
    if (organizerPayment) {
      // Increase organizer's payment to cover unpaid shares
      await txn.bookingPaymentLeg.update({
        where: { id: organizerPayment.id },
        data: { amount: { increment: totalUnpaid } },
      });
    } else {
      // Create new payment for organizer covering unpaid shares
      await txn.bookingPaymentLeg.create({
        data: {
          bookingId: booking.id,
          userId: organizerId,
          userType: "Player",
          amount: toInt(totalUnpaid),
          status: "PENDING",
        },
      });
    }

    // Remove unpaid payments from other users
    await txn.bookingPaymentLeg.deleteMany({
      where: {
        bookingId: booking.id,
        userType: "Player",
        status: "PENDING",
        userId: { not: organizerId },
      },
    });
  });

  // Send notifications to users whose payments were covered
  const venue = booking.venueId
    ? await prisma.venue.findUnique({
        where: { id: booking.venueId },
        select: { name: true },
      })
    : null;
  const organizer = await prisma.user.findUnique({
    where: { id: organizerId },
    select: { name: true },
  });

  for (const userId of coveredUserIds) {
    NotificationService.send({
      userId: userId,
      type: "PAYMENT_SPLIT_RECEIVED",
      title: "Payment Covered",
      message: `${organizer?.name || "The organizer"} has covered your share for ${booking.sport} at ${venue?.name || "the venue"}.`,
      data: {
        bookingId: booking.id.toString(),
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

  const finalBooking = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: bookingChildren,
  });

  return finalBooking as BookingDocument;
};

/**
 * Get booking invitations for a user
 */
export const getUserBookingInvitations = async (
  userId: string,
  status?: "PENDING" | "ACCEPTED" | "DECLINED",
): Promise<any[]> => {
  const where: any = { inviteeId: userId };
  if (status) {
    where.status = status;
  }

  const invitations = await prisma.bookingInvitation.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // Populate the String-FK refs (inviterId/venueId/coachId/bookingId) via
  // follow-up queries and attach them the way Mongoose populate did.
  const [inviters, venues, coaches, bookings] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: uniqueStrings(invitations.map((i) => i.inviterId)) } },
      select: { id: true, name: true, email: true, photoUrl: true },
    }),
    prisma.venue.findMany({
      where: { id: { in: uniqueStrings(invitations.map((i) => i.venueId)) } },
      select: { id: true, name: true, address: true },
    }),
    prisma.coach.findMany({
      where: { id: { in: uniqueStrings(invitations.map((i) => i.coachId)) } },
      select: { id: true, sports: true },
    }),
    prisma.booking.findMany({
      where: { id: { in: uniqueStrings(invitations.map((i) => i.bookingId)) } },
      include: bookingChildren,
    }),
  ]);

  const invitersById = new Map(inviters.map((u) => [u.id, u]));
  const venuesById = new Map(venues.map((v) => [v.id, v]));
  const coachesById = new Map(coaches.map((c) => [c.id, c]));
  const bookingsById = new Map(bookings.map((b) => [b.id, b]));

  return invitations.map((invitation) => {
    const augmented: any = { ...invitation };
    augmented.inviterId =
      invitersById.get(invitation.inviterId) ?? invitation.inviterId;
    augmented.venueId = invitation.venueId
      ? (venuesById.get(invitation.venueId) ?? invitation.venueId)
      : invitation.venueId;
    augmented.coachId = invitation.coachId
      ? (coachesById.get(invitation.coachId) ?? invitation.coachId)
      : invitation.coachId;
    augmented.bookingId =
      bookingsById.get(invitation.bookingId) ?? invitation.bookingId;
    return augmented;
  });
};

// Legacy function for backward compatibility
export const createBooking = initiateBooking;

/**
 * Cleanup stale booking slot locks
 * Removes locks for dates in the past (older than today)
 * Can be called periodically via cron job
 */
export const cleanupStaleBookingLocks = async (): Promise<number> => {
  // "Today" in IST — dateKey values are IST calendar dates (see
  // combineDateAndTimeIST), so the cutoff must be computed the same way
  // rather than the server process's local midnight.
  const todayKey = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Delete locks with dateKey < today (past dates)
  const result = await prisma.bookingSlotLock.deleteMany({
    where: { dateKey: { lt: todayKey } },
  });

  return result.count || 0;
};

/**
 * Cleanup expired bookings
 * Deletes bookings that have passed their expiration time without payment
 * Only affects bookings that are still pending payment confirmation
 * Returns number of expired bookings deleted
 */
export const cleanupExpiredBookings = async (): Promise<number> => {
  const now = new Date();

  const result = await prisma.booking.deleteMany({
    where: {
      status: { in: ["PENDING_CONFIRMATION", "PENDING_INVITES"] },
      paymentConfirmedAt: null,
      expiresAt: { lt: now },
    },
  });

  return result.count || 0;
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

  const transaction = await prisma.bookingPaymentTransaction.findUnique({
    where: { merchantOrderId },
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

  let newStatus: "COMPLETED" | "FAILED" | undefined;

  if (state === "COMPLETED" && transaction.status !== "COMPLETED") {
    newStatus = "COMPLETED";
    await updatePaymentStatus(
      transaction.bookingId.toString(),
      transaction.userId.toString(),
      "PAID",
    );
    console.info(
      `[BookingWebhook] Payment confirmed for booking ${transaction.bookingId}, merchantOrderId=${merchantOrderId}`,
    );
  } else if (state === "FAILED" && transaction.status !== "FAILED") {
    newStatus = "FAILED";
    await updatePaymentStatus(
      transaction.bookingId.toString(),
      transaction.userId.toString(),
      "FAILED",
    );
    console.info(
      `[BookingWebhook] Payment failed for booking ${transaction.bookingId}, merchantOrderId=${merchantOrderId}`,
    );
  }

  // Store the webhook callback on the transaction (+ state / status change).
  const updated = await prisma.bookingPaymentTransaction.update({
    where: { id: transaction.id },
    data: {
      callbackPayload: payload as any,
      state,
      ...(newStatus ? { status: newStatus } : {}),
    },
  });

  return updated;
};

/**
 * When a booking is cancelled, alert users waiting on the same slot (same
 * coach/venue + date + start time) by email, then mark their waitlist entry
 * NOTIFIED so they are not pinged repeatedly. Best-effort; never throws.
 */
const notifyWaitlistForFreedSlot = async (
  booking: BookingDocument,
): Promise<void> => {
  try {
    const where: Record<string, unknown> = {
      status: "ACTIVE",
      date: booking.date,
      startTime: booking.startTime,
    };
    if (booking.coachId) {
      where.coachId = booking.coachId;
    } else if (booking.venueId) {
      where.venueId = booking.venueId;
    } else {
      return;
    }

    const entries = await prisma.bookingWaitlist.findMany({
      where: where as any,
      take: 50,
    });
    if (entries.length === 0) {
      return;
    }

    let venueName = "your coach";
    if (booking.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: booking.venueId },
        select: { name: true },
      });
      venueName = venue?.name || "the venue";
    }

    for (const entry of entries) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: entry.userId },
          select: { name: true, email: true },
        });
        if (user?.email) {
          await sendWaitlistSlotAvailableEmail({
            name: user.name,
            email: user.email,
            venueName,
            sport: booking.sport,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
          });
        }
        await prisma.bookingWaitlist.update({
          where: { id: entry.id },
          data: { status: "NOTIFIED" },
        });
      } catch (perEntryError) {
        console.error(
          "Failed to notify waitlist entry",
          entry.id?.toString(),
          perEntryError,
        );
      }
    }
  } catch (error) {
    console.error("Failed to notify waitlist for freed slot:", error);
  }
};
