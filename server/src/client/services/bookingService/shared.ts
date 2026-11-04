import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { Booking, BookingDelivery, BookingDocument } from "../../models/Booking";
import { type ProjectedExpertBooking } from "../../../utils/expertSessionMapping";
import { log as __rootLog } from "../../../utils/logger";

const log = __rootLog.child("booking");

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
    /** Optional street address; persisted onto the booking's delivery record. */
    address?: string;
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

// Fee rates come from the shared pricing module (imported at the top) so the
// amount charged here and the amount quoted to the client cannot drift.

export interface BookingCreatePayload {
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
  delivery?: BookingDelivery;
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

// toDayRange/getDateKey below derive day boundaries from a UTC-midnight-
// anchored booking `date` — using UTC accessors keeps them correct
// regardless of the server process's local timezone (see combineDateAndTimeIST
// in utils/openingHours.ts, used below, for the fuller explanation).
const toDayRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
};

const getDateKey = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
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

const toRadians = (value: number): number => (value * Math.PI) / 180;

const calculateDistanceKm = (from: [number, number], to: [number, number]): number => {
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
 * Get all bookings for a user
 */
/**
 * Get all bookings for a user
 */
/**
 * Flatten a populated Expert into the shape the client already reads elsewhere:
 * `name` at the top level rather than nested under `userId`. Mirrors
 * ExpertsService's serializeExpert for the handful of display fields a booking
 * card needs, without pulling in that module's full (and sensitive) payload.
 */
const expertDisplayFields = (expert: unknown): unknown => {
  if (!expert || typeof expert !== "object") return expert;
  const e = expert as {
    _id?: unknown;
    photoUrl?: string;
    city?: string;
    sessionMode?: string;
    timezone?: string;
    rating?: number;
    reviewCount?: number;
    userId?: { name?: string } | unknown;
  };
  const user = e.userId as { name?: string } | undefined;
  return {
    id: e._id ? String(e._id) : undefined,
    _id: e._id,
    name: user && typeof user === "object" ? user.name : undefined,
    photoUrl: e.photoUrl,
    city: e.city,
    sessionMode: e.sessionMode,
    timezone: e.timezone,
    rating: e.rating,
    reviewCount: e.reviewCount,
  };
};

/**
 * A row in a parent's booking list: either a real Booking, or an expert session
 * projected into the same shape (see projectExpertSessionAsBooking).
 */
export type UserBookingRow = BookingDocument | ProjectedExpertBooking;

/**
 * Upper bound on rows read per source before merging.
 *
 * This path is per-parent, where real counts are in the tens, so the cap only
 * exists so a pathological account cannot pull an unbounded result set into
 * memory. It is far above any realistic booking history.
 */
const USER_BOOKING_SCAN_CAP = 500;

const createdAtOf = (row: UserBookingRow): number => {
  const value = (row as { createdAt?: Date }).createdAt;
  return value ? new Date(value).getTime() : 0;
};

const toPaise = (amount: number): number => Math.round(amount * 100);

const getBookingParticipantIds = (booking: BookingDocument): string[] => {
  const acceptedParticipants = booking.participants
    .filter((participant) => participant.status === "ACCEPTED")
    .map((participant) => participant.userId.toString());

  return Array.from(new Set([booking.organizerId.toString(), ...acceptedParticipants]));
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

export {
  log,
  TIME_FORMAT_REGEX,
  CHECK_IN_CODE_CHARS,
  MAX_TRANSACTION_RETRIES,
  COACH_SUBSCRIPTIONS_ENFORCE_BOOKING,
  generateRandomCheckInCode,
  generateUniqueCheckInCode,
  normalizeTimeToHHmm,
  toDayRange,
  getDateKey,
  hasErrorLabel,
  isRetryableTransactionError,
  toRadians,
  calculateDistanceKm,
  expertDisplayFields,
  USER_BOOKING_SCAN_CAP,
  createdAtOf,
  toPaise,
  getBookingParticipantIds,
  pickString,
  asRec,
};
