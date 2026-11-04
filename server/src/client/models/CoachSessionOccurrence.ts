import mongoose, { Document, Schema } from "mongoose";
import { BookingDelivery } from "./Booking";

/**
 * One dated instance of a coach's offering — the entity the coach domain never
 * had, and the thing online coaching makes unavoidable: a meeting link, a join
 * window, an attendance mark and a roster all have to hang somewhere
 * per-session, and there was previously nowhere to hang them.
 *
 * An occurrence is the DELIVERY record. `Booking` remains the money and
 * commitment record. Keeping them separate is what lets one batch session serve
 * eight students who each pay their own subscription — a shape the old model,
 * where one payment == one session == one place, could not express.
 *
 * PAYOUT. An occurrence is also the earning event: the coach is paid per
 * session actually delivered, funded by the credits it consumes. The payout
 * sub-document is 1:1 with the occurrence by definition, so it lives here
 * rather than in a parallel collection.
 */

export type CoachOccurrenceStatus =
  "SCHEDULED" | "COMPLETED" | "CANCELLED_BY_COACH" | "CANCELLED_BY_PLATFORM";

export type CoachAttendanceMark = "PENDING" | "PRESENT" | "ABSENT";

export type CoachOccurrencePayoutStatus = "PENDING" | "RELEASED" | "PAID";

/**
 * A student's place in this session, snapshotted when the occurrence is
 * delivered. Kept on the occurrence rather than joined from enrollments at read
 * time so that a later roster change cannot rewrite who was marked present at a
 * session that already happened.
 */
export interface CoachOccurrenceRosterEntry {
  enrollmentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  studentName: string;
  attendance: CoachAttendanceMark;
  /** The credit this student's seat consumed. Absent until the session completes. */
  creditId?: mongoose.Types.ObjectId | null;
  /** Paise this seat contributed to the coach's earning for this occurrence. */
  earnedPaise?: number;
}

export interface CoachOccurrencePayout {
  status: CoachOccurrencePayoutStatus;
  /**
   * What the coach actually receives: gross minus the platform's commission and
   * the GST on it. `amountPaise` is the NET on purpose — it is the number the
   * payout pipeline pays and the admin screen settles, so anything else here
   * would overpay.
   */
  amountPaise: number;
  /** Sum of the roster's `earnedPaise` — the Partner Fee, before deductions. */
  grossPaise?: number;
  commissionPaise?: number;
  commissionGstPaise?: number;
  commissionRate?: number;
  /** When the amount becomes eligible to pay out. */
  releaseAt?: Date | null;
  paidAt?: Date | null;
}

export interface CoachSessionOccurrenceDocument extends Document {
  id?: string;
  offeringId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  sport: string;
  /** The true instant the session starts. Never a wall-clock pair. */
  scheduledAt: Date;
  durationMinutes: number;
  status: CoachOccurrenceStatus;
  /** Where this session happens, snapshotted. Same shape as a booking's. */
  delivery?: BookingDelivery;
  roster: CoachOccurrenceRosterEntry[];
  /** A session run to replace one the coach cancelled. */
  isMakeup: boolean;
  replacesOccurrenceId?: mongoose.Types.ObjectId | null;
  /** Set when a coach cancellation has been answered by a scheduled makeup. */
  makeupOccurrenceId?: mongoose.Types.ObjectId | null;
  coachNotes?: string;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelReason?: string;
  payout: CoachOccurrencePayout;
  /** One-shot reminder dedup timestamps. */
  meetingLinkNudgeSentAt?: Date | null;
  startReminderSentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const rosterEntrySchema = new Schema<CoachOccurrenceRosterEntry>(
  {
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: "CoachEnrollment",
      required: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", default: null },
    studentName: { type: String, required: true, trim: true },
    attendance: {
      type: String,
      enum: ["PENDING", "PRESENT", "ABSENT"],
      default: "PENDING",
    },
    creditId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSessionCredit",
      default: null,
    },
    earnedPaise: { type: Number, min: 0 },
  },
  { _id: false }
);

const coachSessionOccurrenceSchema = new Schema<CoachSessionOccurrenceDocument>(
  {
    offeringId: {
      type: Schema.Types.ObjectId,
      ref: "CoachOffering",
      required: true,
      index: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
      required: true,
      index: true,
    },
    sport: { type: String, required: true, trim: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    status: {
      type: String,
      enum: ["SCHEDULED", "COMPLETED", "CANCELLED_BY_COACH", "CANCELLED_BY_PLATFORM"],
      default: "SCHEDULED",
      index: true,
    },
    delivery: {
      type: new Schema<BookingDelivery>(
        {
          kind: {
            type: String,
            enum: ["PLATFORM_VENUE", "PROVIDER_VENUE", "STUDENT_LOCATION", "ONLINE"],
            required: true,
          },
          venueId: { type: Schema.Types.ObjectId, ref: "Venue" },
          nameSnapshot: { type: String, trim: true },
          addressSnapshot: { type: String, trim: true },
          coordinates: {
            type: [Number],
            default: undefined,
            validate: {
              validator(v: unknown) {
                if (v === undefined || v === null) return true;
                if (Array.isArray(v) && v.length === 0) return true;
                return (
                  Array.isArray(v) &&
                  v.length === 2 &&
                  v.every((c) => typeof c === "number" && !Number.isNaN(c))
                );
              },
              message: "Coordinates must be [longitude, latitude]",
            },
          },
          platform: { type: String, trim: true },
          meetingLink: { type: String, trim: true },
        },
        { _id: false }
      ),
      required: false,
    },
    roster: { type: [rosterEntrySchema], default: [] },
    isMakeup: { type: Boolean, default: false },
    replacesOccurrenceId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSessionOccurrence",
      default: null,
    },
    makeupOccurrenceId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSessionOccurrence",
      default: null,
    },
    coachNotes: { type: String, trim: true, maxlength: 4000 },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, maxlength: 1000 },
    payout: {
      status: {
        type: String,
        enum: ["PENDING", "RELEASED", "PAID"],
        default: "PENDING",
        index: true,
      },
      amountPaise: { type: Number, default: 0, min: 0 },
      grossPaise: { type: Number, default: 0, min: 0 },
      commissionPaise: { type: Number, default: 0, min: 0 },
      commissionGstPaise: { type: Number, default: 0, min: 0 },
      commissionRate: { type: Number, default: 0, min: 0 },
      releaseAt: { type: Date, default: null },
      paidAt: { type: Date, default: null },
    },
    meetingLinkNudgeSentAt: { type: Date, default: null },
    startReminderSentAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc: any, ret: any) {
        ret.id = ret._id?.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

coachSessionOccurrenceSchema.virtual("id").get(function (this: CoachSessionOccurrenceDocument) {
  return this._id.toString();
});

/**
 * Generation idempotency. Re-running the materialiser over a window must never
 * produce a second copy of the same session, so the (offering, instant) pair is
 * unique at the database level rather than only in the service's logic.
 *
 * Makeups are excluded: a makeup deliberately lands at a time of the coach's
 * choosing and must not collide with the pattern-generated session there.
 */
coachSessionOccurrenceSchema.index(
  { offeringId: 1, scheduledAt: 1 },
  {
    name: "one_generated_occurrence_per_slot",
    unique: true,
    partialFilterExpression: { isMakeup: false },
  }
);

// The coach's calendar, and the conflict check across offerings.
coachSessionOccurrenceSchema.index({ coachId: 1, scheduledAt: 1, status: 1 });
// A student's upcoming sessions.
coachSessionOccurrenceSchema.index({ "roster.userId": 1, scheduledAt: -1 });
// The reminder sweeps, and the payout-release sweep.
coachSessionOccurrenceSchema.index({ status: 1, scheduledAt: 1 });
coachSessionOccurrenceSchema.index({
  "payout.status": 1,
  "payout.releaseAt": 1,
});

export const CoachSessionOccurrence = mongoose.model<CoachSessionOccurrenceDocument>(
  "CoachSessionOccurrence",
  coachSessionOccurrenceSchema
);
