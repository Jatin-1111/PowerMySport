import mongoose, { Document, Schema } from "mongoose";

/**
 * A student's membership in a coach's offering.
 *
 * This is what makes `CoachSubscriptionPackage.maxStudents` mean something —
 * before it existed there was no roster to count against, so the cap was
 * enforced against nothing.
 *
 * Enrollment is deliberately NOT modelled on the existing group-booking
 * participant list. That construct is a social split-payment group (an
 * organizer invites friends, they accept, the fee splits EQUAL). A coaching
 * roster is the opposite on every axis: students do not know each other, nobody
 * invites anybody, each pays their own subscription, the coach owns the roster,
 * and a student can join in week three of a term — which invite/accept cannot
 * express at all.
 */

export type CoachEnrollmentStatus =
  | "PENDING" // created, awaiting first payment
  | "ACTIVE"
  | "PAUSED"
  | "CANCELLED"
  | "COMPLETED"; // the offering ended

export interface CoachEnrollmentDocument extends Document {
  id?: string;
  offeringId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  /** The paying account. */
  userId: mongoose.Types.ObjectId;
  /** The child this enrollment is for, when a parent enrolls a dependent. */
  playerId?: mongoose.Types.ObjectId | null;
  /** The recurring subscription that funds this enrollment. */
  subscriptionId?: mongoose.Types.ObjectId | null;
  status: CoachEnrollmentStatus;
  /**
   * While PENDING, the seat is held but unpaid. The hold reserves capacity so a
   * parent cannot pay and then find the batch full — and it expires, so an
   * abandoned checkout cannot silently consume a seat forever. Mirrors the
   * booking flow's `expiresAt` hold.
   */
  holdExpiresAt?: Date | null;
  /** Display name captured at enrollment, for rosters and attendance sheets. */
  studentName: string;
  joinedAt: Date;
  leftAt?: Date | null;
  cancellationReason?: string;
  /**
   * Where the coach travels to for a STUDENT_LOCATION offering. Held here
   * rather than on the offering because it is per-student by definition, and
   * snapshotted because it feeds occurrence delivery (and therefore invoices).
   */
  deliveryAddress?: {
    addressSnapshot?: string;
    coordinates?: [number, number];
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const coachEnrollmentSchema = new Schema<CoachEnrollmentDocument>(
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    playerId: { type: Schema.Types.ObjectId, ref: "Player", default: null },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSubscription",
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "PAUSED", "CANCELLED", "COMPLETED"],
      default: "PENDING",
      index: true,
    },
    holdExpiresAt: { type: Date, default: null },
    studentName: { type: String, required: true, trim: true },
    joinedAt: { type: Date, required: true, default: Date.now },
    leftAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, maxlength: 1000 },
    deliveryAddress: {
      type: new Schema(
        {
          addressSnapshot: { type: String, trim: true, maxlength: 500 },
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
        },
        { _id: false },
      ),
      default: null,
    },
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

coachEnrollmentSchema.virtual("id").get(function (
  this: CoachEnrollmentDocument,
) {
  return this._id.toString();
});

/**
 * One live enrollment per student per offering.
 *
 * `playerId` is part of the key so a parent can enroll two children in the same
 * batch, and it is coalesced to the userId's own null so the index is stable.
 * Partial on live statuses only, so a student who cancelled can re-join later.
 */
coachEnrollmentSchema.index(
  { offeringId: 1, userId: 1, playerId: 1 },
  {
    name: "one_live_enrollment_per_student",
    unique: true,
    partialFilterExpression: {
      status: { $in: ["PENDING", "ACTIVE", "PAUSED"] },
    },
  },
);

coachEnrollmentSchema.index({ offeringId: 1, status: 1 });
coachEnrollmentSchema.index({ userId: 1, status: 1 });
coachEnrollmentSchema.index({ coachId: 1, status: 1 });
coachEnrollmentSchema.index({ subscriptionId: 1 });
// Drives the sweep that releases seats held by abandoned checkouts.
coachEnrollmentSchema.index({ status: 1, holdExpiresAt: 1 });

export const CoachEnrollment = mongoose.model<CoachEnrollmentDocument>(
  "CoachEnrollment",
  coachEnrollmentSchema,
);
