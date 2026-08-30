import mongoose, { Document, Schema } from "mongoose";
import { BookingDeliveryKind } from "./Booking";

/**
 * What a coach sells: a recurring programme with a schedule, a capacity, and a
 * billing package.
 *
 * This is the entity the coach domain never had. `CoachSubscriptionPackage`
 * already sold "N sessions a month" and `CoachSubscription` already tracked the
 * billing periods — but nothing ever scheduled those sessions, so a subscribed
 * student still booked one-off slots by hand and `maxStudents` was enforced
 * against nothing. The offering is what those two were always implying.
 *
 * 1:1 and batch are THE SAME ENTITY with a different `capacity`. There is no
 * separate "private coaching" type and no code path should branch on
 * `capacity === 1` — if one does, the model is being worked around.
 *
 * The weekly `schedule` is a PATTERN, not a list of sessions. Occurrences are
 * materialised from it into a rolling window by CoachOccurrenceService, as
 * instants, so that editing next month's pattern cannot rewrite sessions that
 * already carry attendance and payouts.
 */

export type CoachOfferingStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

/** One weekly slot. `startTime` is wall-clock in the offering's `timezone`. */
export interface CoachOfferingSlot {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  startTime: string; // "HH:mm"
  durationMinutes: number;
}

/**
 * Where this offering's sessions happen. Reuses the booking delivery vocabulary
 * so an occurrence's delivery snapshot and a booking's are the same shape.
 *
 * STUDENT_LOCATION is the one kind that cannot carry a batch — eight students
 * cannot all be at one student's home — so it is rejected for capacity > 1.
 */
export type CoachOfferingDeliveryKind = Extract<
  BookingDeliveryKind,
  "PLATFORM_VENUE" | "PROVIDER_VENUE" | "STUDENT_LOCATION" | "ONLINE"
>;

export interface CoachOfferingDocument extends Document {
  id?: string;
  coachId: mongoose.Types.ObjectId;
  sport: string;
  title: string;
  description?: string;
  deliveryKind: CoachOfferingDeliveryKind;
  /** PLATFORM_VENUE only. */
  venueId?: mongoose.Types.ObjectId;
  /** ONLINE only. Free text so a coach is not blocked on an enum we did not predict. */
  onlinePlatform?: string;
  /**
   * ONLINE only. The standing room link, copied onto each occurrence at
   * generation time so that changing it later cannot rewrite the link a student
   * was already told to use for a session that has happened.
   */
  defaultMeetingLink?: string;
  /** Maximum enrolled students. 1 = private coaching; > 1 = a batch. */
  capacity: number;
  /**
   * Live enrollments, maintained as a reservation counter rather than counted
   * on demand.
   *
   * Counting enrollments and then inserting one is a race: two parents hitting
   * the last seat in the same instant both see room. Incrementing this field
   * under the condition `enrolledCount < capacity` is a single atomic update,
   * so exactly one of them wins — and it needs no transaction, which means it
   * works on a standalone deployment too.
   */
  enrolledCount: number;
  schedule: CoachOfferingSlot[];
  /** IANA zone the schedule's wall-clock times are read in. */
  timezone: string;
  /** Billing: enrolling means subscribing to this package. */
  packageId: mongoose.Types.ObjectId;
  status: CoachOfferingStatus;
  startDate: Date;
  endDate?: Date | null;
  /** How far occurrences have been materialised. See CoachOccurrenceService. */
  generatedThrough?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const slotSchema = new Schema<CoachOfferingSlot>(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: [0, "dayOfWeek must be 0-6"],
      max: [6, "dayOfWeek must be 0-6"],
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "startTime must be HH:mm"],
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: [15, "A session must be at least 15 minutes"],
      max: [480, "A session cannot exceed 8 hours"],
    },
  },
  { _id: false },
);

const coachOfferingSchema = new Schema<CoachOfferingDocument>(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
      required: [true, "Coach ID is required"],
      index: true,
    },
    sport: { type: String, required: [true, "Sport is required"], trim: true },
    title: { type: String, required: [true, "Title is required"], trim: true },
    description: { type: String, trim: true, maxlength: 2000 },
    deliveryKind: {
      type: String,
      enum: ["PLATFORM_VENUE", "PROVIDER_VENUE", "STUDENT_LOCATION", "ONLINE"],
      required: [true, "Delivery kind is required"],
    },
    venueId: { type: Schema.Types.ObjectId, ref: "Venue" },
    onlinePlatform: { type: String, trim: true, maxlength: 60 },
    defaultMeetingLink: { type: String, trim: true, maxlength: 500 },
    capacity: {
      type: Number,
      required: true,
      default: 1,
      min: [1, "Capacity must be at least 1"],
      max: [100, "Capacity cannot exceed 100"],
    },
    enrolledCount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Enrolled count cannot go negative"],
    },
    schedule: {
      type: [slotSchema],
      required: true,
      validate: {
        validator: (v: CoachOfferingSlot[]) => Array.isArray(v) && v.length > 0,
        message: "An offering needs at least one weekly slot",
      },
    },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSubscriptionPackage",
      required: [true, "A billing package is required"],
      index: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"],
      default: "DRAFT",
      index: true,
    },
    startDate: { type: Date, required: [true, "Start date is required"] },
    endDate: { type: Date, default: null },
    generatedThrough: { type: Date, default: null },
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
  },
);

coachOfferingSchema.virtual("id").get(function (this: CoachOfferingDocument) {
  return this._id.toString();
});

/**
 * Delivery-kind invariants. These live on the model rather than only in the
 * service so no future write path (admin panel, import script, test fixture)
 * can create an offering that cannot actually be delivered.
 */
coachOfferingSchema.pre<CoachOfferingDocument>("validate", function () {
  if (this.deliveryKind === "STUDENT_LOCATION" && this.capacity > 1) {
    this.invalidate(
      "capacity",
      "A batch cannot be delivered at a student's location — eight students " +
        "cannot share one home. Use a venue or online for capacity > 1.",
    );
  }

  if (this.deliveryKind === "PLATFORM_VENUE" && !this.venueId) {
    this.invalidate("venueId", "A venue-based offering needs a venueId");
  }

  if (this.deliveryKind === "ONLINE" && !this.onlinePlatform?.trim()) {
    this.invalidate(
      "onlinePlatform",
      "An online offering must say which platform it runs on",
    );
  }

  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    this.invalidate("endDate", "endDate must be after startDate");
  }

  // Two slots at the same weekday and time would generate two occurrences that
  // collide on the (offeringId, scheduledAt) uniqueness rule.
  const seen = new Set<string>();
  for (const slot of this.schedule || []) {
    const key = `${slot.dayOfWeek}@${slot.startTime}`;
    if (seen.has(key)) {
      this.invalidate("schedule", `Duplicate weekly slot: ${key}`);
      break;
    }
    seen.add(key);
  }
});

coachOfferingSchema.index({ coachId: 1, status: 1 });
coachOfferingSchema.index({ sport: 1, status: 1 });
coachOfferingSchema.index({ deliveryKind: 1, status: 1 });
// Drives the occurrence-generation sweep.
coachOfferingSchema.index({ status: 1, generatedThrough: 1 });

export const CoachOffering = mongoose.model<CoachOfferingDocument>(
  "CoachOffering",
  coachOfferingSchema,
);
