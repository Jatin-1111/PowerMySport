import mongoose from "mongoose";
import { deriveBookingProviderType } from "../models/Booking";
import {
  BookingEvent,
  BookingEventActorType,
  BookingEventChannel,
  BookingEventDocument,
  BookingEventProviderType,
  BookingEventSubjectType,
  BookingEventType,
} from "../models/BookingEvent";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("bookingEvent");

/**
 * Write/read surface for the booking audit log.
 *
 * The cardinal rule: recording an event must NEVER break the thing it is
 * recording. A booking that succeeded but failed to log is a monitoring
 * problem; a booking that failed *because* logging failed is an outage. So
 * `record()` swallows its own errors and reports them to the console rather
 * than propagating. Callers are free to `await` it or not.
 */

export interface RecordBookingEventInput {
  subjectType: BookingEventSubjectType;
  subjectId: mongoose.Types.ObjectId | string;
  providerType: BookingEventProviderType;
  providerId?: mongoose.Types.ObjectId | string | null | undefined;

  type: BookingEventType;

  fromStatus?: string | null | undefined;
  toStatus?: string | null | undefined;

  actorType: BookingEventActorType;
  actorUserId?: mongoose.Types.ObjectId | string | null | undefined;
  channel: BookingEventChannel;

  /** PAISE. Rupee figures must be converted by the caller. */
  amountPaise?: number | null | undefined;

  summary?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;

  /** Defaults to now. Pass explicitly for cron jobs acting on past deadlines. */
  occurredAt?: Date | undefined;
}

const toObjectId = (
  value: mongoose.Types.ObjectId | string | null | undefined
): mongoose.Types.ObjectId | undefined => {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : undefined;
};

/**
 * Derive the provider dimensions from a Booking document.
 *
 * The type itself comes from `deriveBookingProviderType` on the model — the
 * same function the pre-validate hook uses — so the event log and the stored
 * `providerType` cannot disagree about what kind of booking this is. This
 * function only adds the matching provider id.
 *
 * Prefers the booking's stored `providerType` when present, falling back to
 * deriving it: events are recorded for legacy documents too, and those predate
 * the field.
 */
export const providerDimensionsForBooking = (booking: {
  venueId?: unknown;
  coachId?: unknown;
  academyId?: unknown;
  providerType?: unknown;
}): {
  providerType: BookingEventProviderType;
  providerId?: mongoose.Types.ObjectId;
} => {
  const providerType =
    (booking.providerType as BookingEventProviderType) || deriveBookingProviderType(booking);

  const sourceId =
    providerType === "ACADEMY"
      ? booking.academyId
      : providerType === "COACH"
        ? booking.coachId
        : booking.venueId;

  const providerId = sourceId ? toObjectId(String(sourceId)) : undefined;

  return {
    providerType,
    ...(providerId ? { providerId } : {}),
  };
};

/**
 * Append one event. Never throws.
 *
 * Returns the created document, or null if the write failed (or the input was
 * unusable) — callers that care can check, but none are expected to.
 */
export const recordBookingEvent = async (
  input: RecordBookingEventInput
): Promise<BookingEventDocument | null> => {
  try {
    const subjectId = toObjectId(input.subjectId);
    if (!subjectId) {
      log.error("[BookingEventService] refusing to record event without a valid subjectId", {
        type: input.type,
        subjectId: input.subjectId,
      });
      return null;
    }

    const providerId = toObjectId(input.providerId);
    const actorUserId = toObjectId(input.actorUserId);

    // Built field-by-field rather than spreading the input: `strict: true` on
    // the schema would drop unknown keys silently, and exactOptionalPropertyTypes
    // means `undefined` cannot be assigned to optional fields.
    return await BookingEvent.create({
      subjectType: input.subjectType,
      subjectId,
      providerType: input.providerType,
      ...(providerId ? { providerId } : {}),
      type: input.type,
      ...(input.fromStatus ? { fromStatus: input.fromStatus } : {}),
      ...(input.toStatus ? { toStatus: input.toStatus } : {}),
      actorType: input.actorType,
      ...(actorUserId ? { actorUserId } : {}),
      channel: input.channel,
      ...(typeof input.amountPaise === "number" &&
      Number.isFinite(input.amountPaise) &&
      input.amountPaise >= 0
        ? { amountPaise: Math.round(input.amountPaise) }
        : {}),
      ...(input.summary ? { summary: input.summary.slice(0, 500) } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      occurredAt: input.occurredAt ?? new Date(),
    });
  } catch (error) {
    // Deliberately swallowed — see the contract at the top of this file.
    log.error(
      `[BookingEventService] failed to record ${input.type} for ${input.subjectType} ${String(
        input.subjectId
      )}:`,
      error
    );
    return null;
  }
};

/**
 * Convenience wrapper for Booking-subject events: fills in subjectType and
 * derives providerType/providerId from the booking so call sites stay short.
 */
export const recordBookingEventFor = async (
  booking: {
    _id: mongoose.Types.ObjectId | string;
    venueId?: unknown;
    coachId?: unknown;
    academyId?: unknown;
  },
  input: Omit<RecordBookingEventInput, "subjectType" | "subjectId" | "providerType" | "providerId">
): Promise<BookingEventDocument | null> => {
  const dimensions = providerDimensionsForBooking(booking);
  return recordBookingEvent({
    ...input,
    subjectType: "BOOKING",
    subjectId: booking._id,
    providerType: dimensions.providerType,
    ...(dimensions.providerId ? { providerId: dimensions.providerId } : {}),
  });
};

/** Convenience wrapper for ExpertSession-subject events. */
export const recordExpertSessionEvent = async (
  session: { _id: mongoose.Types.ObjectId | string; expertId?: unknown },
  input: Omit<RecordBookingEventInput, "subjectType" | "subjectId" | "providerType" | "providerId">
): Promise<BookingEventDocument | null> => {
  const providerId = session.expertId ? toObjectId(String(session.expertId)) : undefined;
  return recordBookingEvent({
    ...input,
    subjectType: "EXPERT_SESSION",
    subjectId: session._id,
    providerType: "EXPERT",
    ...(providerId ? { providerId } : {}),
  });
};

/**
 * Full timeline for one booking or session, oldest first.
 * Actor is populated so admin/support UIs can show a name instead of an id.
 */
export const getBookingEventTimeline = async (
  subjectType: BookingEventSubjectType,
  subjectId: string
): Promise<BookingEventDocument[]> => {
  if (!mongoose.Types.ObjectId.isValid(subjectId)) {
    return [];
  }

  return BookingEvent.find({
    subjectType,
    subjectId: new mongoose.Types.ObjectId(subjectId),
  })
    .sort({ occurredAt: 1, createdAt: 1 })
    .populate("actorUserId", "name email role")
    .lean<BookingEventDocument[]>();
};

/**
 * Timeline lookup when the caller has an id but doesn't know which system the
 * booking belongs to — the common case for support tooling, where someone
 * pastes an id from an email or a URL.
 */
export const getBookingEventTimelineByIdAcrossSubjects = async (
  subjectId: string
): Promise<BookingEventDocument[]> => {
  if (!mongoose.Types.ObjectId.isValid(subjectId)) {
    return [];
  }

  return BookingEvent.find({
    subjectId: new mongoose.Types.ObjectId(subjectId),
  })
    .sort({ occurredAt: 1, createdAt: 1 })
    .populate("actorUserId", "name email role")
    .lean<BookingEventDocument[]>();
};

export const BookingEventService = {
  record: recordBookingEvent,
  recordForBooking: recordBookingEventFor,
  recordForExpertSession: recordExpertSessionEvent,
  getTimeline: getBookingEventTimeline,
  getTimelineByIdAcrossSubjects: getBookingEventTimelineByIdAcrossSubjects,
};
