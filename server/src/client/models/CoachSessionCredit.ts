import mongoose, { Document, Schema } from "mongoose";

/**
 * One prepaid session on an enrollment.
 *
 * This single entity is what makes three separate-looking product rules fall
 * out of one mechanism:
 *
 *  - PAYOUT PER OCCURRENCE. A credit's `valuePaise` is this student's share of
 *    the period fee. Consuming it IS the coach's earning event, so the coach is
 *    paid for sessions actually delivered rather than for time billed.
 *  - MAKEUP WHEN THE COACH CANCELS. A coach cancellation consumes nothing, so
 *    the credit simply survives and the makeup spends it later. A makeup needs
 *    no separate entity and no special payout rule — it is the same credit
 *    being spent on a different date.
 *  - REFUND ON MID-PERIOD CANCELLATION. Unconsumed credits ARE the refund
 *    basis, computed rather than estimated.
 *
 * A student no-show consumes the credit: the coach showed up and is paid. That
 * is a deliberate policy decision, not a side effect — makeups are owed only
 * when the COACH cancels.
 *
 * ALLOCATION. Credits are granted per billing period and split the period fee
 * exactly: the rounding residue is distributed across the first credits rather
 * than dropped, so the sum of a period's credits always equals the fee charged.
 * Getting that wrong drifts the books by a rupee per student per period forever.
 */

export type CoachSessionCreditStatus =
  | "AVAILABLE"
  | "CONSUMED"
  | "EXPIRED"
  /**
   * Owed back, but the money has not moved yet.
   *
   * A credit sits here between a student leaving and the refund actually
   * settling. It exists because the period-end expiry sweep only touches
   * AVAILABLE credits — without a frozen state, a refund that failed on its
   * first attempt would have its credits quietly EXPIRED at period end and the
   * student's claim would vanish with them.
   */
  | "REFUND_PENDING"
  | "REFUNDED";

export interface CoachSessionCreditDocument extends Document {
  id?: string;
  enrollmentId: mongoose.Types.ObjectId;
  offeringId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  subscriptionId?: mongoose.Types.ObjectId | null;
  /** The billing period this credit was granted for. */
  periodStart: Date;
  periodEnd: Date;
  /** This credit's share of the period fee, in paise. */
  valuePaise: number;
  status: CoachSessionCreditStatus;
  consumedByOccurrenceId?: mongoose.Types.ObjectId | null;
  consumedAt?: Date | null;
  expiredAt?: Date | null;
  refundedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const coachSessionCreditSchema = new Schema<CoachSessionCreditDocument>(
  {
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: "CoachEnrollment",
      required: true,
      index: true,
    },
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
      index: true,
    },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true, index: true },
    valuePaise: {
      type: Number,
      required: true,
      min: [0, "A credit cannot be worth a negative amount"],
    },
    status: {
      type: String,
      enum: [
        "AVAILABLE",
        "CONSUMED",
        "EXPIRED",
        "REFUND_PENDING",
        "REFUNDED",
      ],
      default: "AVAILABLE",
      index: true,
    },
    consumedByOccurrenceId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSessionOccurrence",
      default: null,
    },
    consumedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
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

coachSessionCreditSchema.virtual("id").get(function (
  this: CoachSessionCreditDocument,
) {
  return this._id.toString();
});

/**
 * A consumed credit must say what consumed it. Without this a credit could be
 * spent with no link to the session that spent it, and the payout for that
 * session would be unauditable.
 */
coachSessionCreditSchema.pre<CoachSessionCreditDocument>(
  "validate",
  function () {
    if (this.status === "CONSUMED" && !this.consumedByOccurrenceId) {
      this.invalidate(
        "consumedByOccurrenceId",
        "A consumed credit must record the occurrence that consumed it",
      );
    }
  },
);

// Drives the "does this student have a credit to spend" lookup on completion.
coachSessionCreditSchema.index({ enrollmentId: 1, status: 1, periodEnd: 1 });
// Drives the period-expiry sweep.
coachSessionCreditSchema.index({ status: 1, periodEnd: 1 });
// A credit is spent by at most one occurrence.
coachSessionCreditSchema.index(
  { consumedByOccurrenceId: 1, enrollmentId: 1 },
  {
    name: "one_credit_per_enrollment_per_occurrence",
    unique: true,
    partialFilterExpression: { consumedByOccurrenceId: { $type: "objectId" } },
  },
);

export const CoachSessionCredit = mongoose.model<CoachSessionCreditDocument>(
  "CoachSessionCredit",
  coachSessionCreditSchema,
);
