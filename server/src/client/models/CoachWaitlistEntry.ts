import mongoose, { Document, Schema } from "mongoose";

/**
 * Someone waiting for a seat in a full programme.
 *
 * Deliberately NOT an enrolment with a "WAITING" status. A waitlist entry has
 * no seat, no subscription, no credits and no place on any roster — giving it
 * an enrolment row would mean every query that counts students, grants credits
 * or builds a roster had to remember to exclude it, and one that forgot would
 * quietly overfill a batch or mint credits for someone who never paid.
 *
 * HOW A FREED SEAT IS OFFERED. Everyone waiting is notified, and the first to
 * complete checkout gets it — the ordinary capacity reservation decides the
 * winner, exactly as it does for anyone else.
 *
 * The alternative — offering the seat to one person at a time with an exclusive
 * hold — is fairer to whoever queued first, but it stalls: if the front of the
 * queue never responds, the seat sits empty until something times them out.
 * This is the simpler, non-stalling choice, and the cooldown below stops it
 * from becoming spam. Worth revisiting if waitlists get long.
 */

export type CoachWaitlistStatus =
  | "WAITING"
  | "NOTIFIED"
  | "CONVERTED"
  | "CANCELLED";

export interface CoachWaitlistEntryDocument extends Document {
  id?: string;
  offeringId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  studentName: string;
  status: CoachWaitlistStatus;
  /** Last time this person was told a seat was free — drives the cooldown. */
  lastNotifiedAt?: Date | null;
  notifyCount: number;
  joinedAt: Date;
  leftAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const coachWaitlistEntrySchema = new Schema<CoachWaitlistEntryDocument>(
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
    studentName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["WAITING", "NOTIFIED", "CONVERTED", "CANCELLED"],
      default: "WAITING",
      index: true,
    },
    lastNotifiedAt: { type: Date, default: null },
    notifyCount: { type: Number, default: 0, min: 0 },
    joinedAt: { type: Date, required: true, default: Date.now },
    leftAt: { type: Date, default: null },
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

coachWaitlistEntrySchema.virtual("id").get(function (
  this: CoachWaitlistEntryDocument,
) {
  return this._id.toString();
});

/**
 * One live waitlist entry per student per programme. Partial on the live
 * statuses so somebody who left, or who got in and later cancelled, can queue
 * again later.
 */
coachWaitlistEntrySchema.index(
  { offeringId: 1, userId: 1, playerId: 1 },
  {
    name: "one_live_waitlist_entry_per_student",
    unique: true,
    partialFilterExpression: { status: { $in: ["WAITING", "NOTIFIED"] } },
  },
);

// FIFO reads, and the sweep that finds who to tell about a freed seat.
coachWaitlistEntrySchema.index({ offeringId: 1, status: 1, joinedAt: 1 });
coachWaitlistEntrySchema.index({ userId: 1, status: 1 });

export const CoachWaitlistEntry = mongoose.model<CoachWaitlistEntryDocument>(
  "CoachWaitlistEntry",
  coachWaitlistEntrySchema,
);
