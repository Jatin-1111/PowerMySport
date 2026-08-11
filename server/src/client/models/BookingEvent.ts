import mongoose, { Document, Schema } from "mongoose";

/**
 * Append-only audit log for the booking lifecycle.
 *
 * The booking documents themselves are mutated in place — `status` is
 * overwritten, and `cancelledAt`/`cancellationReason` are the only forensic
 * breadcrumbs left behind. That makes it impossible to answer basic
 * operational questions after the fact: who changed this booking, when, from
 * what to what, and through which surface. This collection is the record of
 * *what happened*, as opposed to the booking's record of *what is true now*.
 *
 * Design notes:
 * - Deliberately polymorphic over `subjectType`. Venue/coach/academy bookings
 *   live in `Booking` and expert consultations in `ExpertSession`; a single
 *   log spanning both is what makes cross-role questions answerable today,
 *   and means the log survives unchanged when those two models are unified.
 * - `providerType` is denormalized so slices ("all academy cancellations last
 *   month") don't need a lookup against two different collections.
 * - Money is always PAISE, matching BookingPaymentTransaction. Never rupees.
 * - Writes are strictly append-only: update and delete are blocked at the
 *   schema level (see hooks below). An audit log you can quietly edit is not
 *   an audit log.
 *
 * Relationship to `AdminAuditLog` (admin/models/AdminAuditLog.ts): that
 * collection answers "which admin performed which admin-panel action" across
 * every entity type — it is accountability for staff. This one answers "what
 * happened to this booking" across every actor, including users, providers,
 * cron jobs and the payment gateway. They overlap only for admin-initiated
 * booking changes, which legitimately appear in both. Do not merge them.
 */

export type BookingEventSubjectType = "BOOKING" | "EXPERT_SESSION";

export type BookingEventProviderType =
  | "VENUE"
  | "COACH"
  | "ACADEMY"
  | "EXPERT";

/**
 * Who caused the event.
 * SYSTEM = a cron/background job. GATEWAY = PhonePe (webhook or status poll).
 */
export type BookingEventActorType =
  | "USER"
  | "PROVIDER"
  | "ADMIN"
  | "SYSTEM"
  | "GATEWAY";

/**
 * Which surface the event arrived through — the "how" behind the actor.
 *
 * BACKFILL is not a surface: it marks an event that was RECONSTRUCTED from a
 * booking document after the fact, rather than observed as it happened. Those
 * events are necessarily thinner (the real channel was never recorded, and the
 * status at creation is unknown), so they must stay distinguishable from
 * observed ones forever — otherwise every later analysis silently mixes
 * measured facts with inferred ones.
 */
export type BookingEventChannel =
  | "CLIENT_WEB"
  | "PROVIDER_WEB"
  | "ADMIN_PANEL"
  | "CRON"
  | "WEBHOOK"
  | "SYSTEM"
  | "BACKFILL";

export type BookingEventType =
  // lifecycle
  | "CREATED"
  | "STATUS_CHANGED"
  | "EXPIRED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW"
  | "RESCHEDULED"
  | "CHECKED_IN"
  // provider response
  | "PROVIDER_CONFIRMED"
  | "PROVIDER_REJECTED"
  // money in
  | "PAYMENT_INITIATED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_FAILED"
  // money out
  | "REFUND_INITIATED"
  | "REFUND_COMPLETED"
  | "REFUND_FAILED"
  | "PAYOUT_RELEASED"
  // group bookings
  | "INVITE_SENT"
  | "INVITE_RESPONDED"
  // expert-specific
  | "MEETING_LINK_SET"
  | "MOM_ADDED"
  | "REVIEW_SUBMITTED";

export const BOOKING_EVENT_TYPES: BookingEventType[] = [
  "CREATED",
  "STATUS_CHANGED",
  "EXPIRED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
  "RESCHEDULED",
  "CHECKED_IN",
  "PROVIDER_CONFIRMED",
  "PROVIDER_REJECTED",
  "PAYMENT_INITIATED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_FAILED",
  "REFUND_INITIATED",
  "REFUND_COMPLETED",
  "REFUND_FAILED",
  "PAYOUT_RELEASED",
  "INVITE_SENT",
  "INVITE_RESPONDED",
  "MEETING_LINK_SET",
  "MOM_ADDED",
  "REVIEW_SUBMITTED",
];

export interface BookingEventDocument extends Document {
  subjectType: BookingEventSubjectType;
  subjectId: mongoose.Types.ObjectId;
  providerType: BookingEventProviderType;
  /** The venue/coach/academy/expert the booking is against, when known. */
  providerId?: mongoose.Types.ObjectId;

  type: BookingEventType;

  /** Set on transitions so a status history can be replayed without diffing. */
  fromStatus?: string;
  toStatus?: string;

  actorType: BookingEventActorType;
  /** Absent for SYSTEM/GATEWAY actors. */
  actorUserId?: mongoose.Types.ObjectId;
  channel: BookingEventChannel;

  /** PAISE. Present on money events only. */
  amountPaise?: number;

  /** Human-readable one-liner for support/admin timelines. */
  summary?: string;
  /** Event-specific extras (merchantOrderId, refundState, reason, …). */
  metadata?: Record<string, unknown>;

  /** When the thing happened (may predate insertion for backfilled/cron events). */
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingEventSchema = new Schema<BookingEventDocument>(
  {
    subjectType: {
      type: String,
      enum: ["BOOKING", "EXPERT_SESSION"],
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    providerType: {
      type: String,
      enum: ["VENUE", "COACH", "ACADEMY", "EXPERT"],
      required: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
    },
    type: {
      type: String,
      enum: BOOKING_EVENT_TYPES,
      required: true,
    },
    fromStatus: {
      type: String,
      trim: true,
    },
    toStatus: {
      type: String,
      trim: true,
    },
    actorType: {
      type: String,
      enum: ["USER", "PROVIDER", "ADMIN", "SYSTEM", "GATEWAY"],
      required: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    channel: {
      type: String,
      enum: [
        "CLIENT_WEB",
        "PROVIDER_WEB",
        "ADMIN_PANEL",
        "CRON",
        "WEBHOOK",
        "SYSTEM",
        "BACKFILL",
      ],
      required: true,
    },
    amountPaise: {
      type: Number,
      min: 0,
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
    // Nothing outside this schema should be able to smuggle fields into an
    // audit record.
    strict: true,
  },
);

// The main read pattern: one booking's full timeline, oldest first.
bookingEventSchema.index(
  { subjectType: 1, subjectId: 1, occurredAt: 1 },
  { name: "event_subject_timeline" },
);

// Operational slices: "all academy cancellations last month", "refund events
// this week", "everything this admin touched".
bookingEventSchema.index(
  { providerType: 1, type: 1, occurredAt: -1 },
  { name: "event_provider_type_recent" },
);
bookingEventSchema.index({ type: 1, occurredAt: -1 }, { name: "event_type_recent" });
bookingEventSchema.index(
  { actorUserId: 1, occurredAt: -1 },
  { name: "event_actor_recent" },
);

/**
 * Append-only enforcement.
 *
 * Mongoose has no single "immutable document" switch, so every mutating entry
 * point is closed individually. Missing one would leave a silent hole in the
 * guarantee, so this list intentionally covers the delete/update middleware
 * surface rather than just the common calls.
 */
const blockMutation = function () {
  throw new Error(
    "BookingEvent is append-only — events cannot be modified or deleted. " +
      "Record a new corrective event instead.",
  );
};

for (const op of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const) {
  bookingEventSchema.pre(op, blockMutation);
}

// Document-level guard: re-saving an already-persisted event. Inserts arrive
// here too, so only non-new documents are rejected.
bookingEventSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error(
      "BookingEvent is append-only — an existing event cannot be re-saved.",
    );
  }
});

// `doc.deleteOne()` is document middleware and needs registering separately
// from the query-level `deleteOne` handled in the loop above.
bookingEventSchema.pre(
  "deleteOne",
  { document: true, query: false },
  blockMutation,
);

export const BookingEvent = mongoose.model<BookingEventDocument>(
  "BookingEvent",
  bookingEventSchema,
);
