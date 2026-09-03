import mongoose, { Document, Schema } from "mongoose";

export type CoachSubscriptionPaymentStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface CoachSubscriptionPaymentDocument extends Document {
  id?: string;
  coachId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  dependentId?: mongoose.Types.ObjectId;
  packageId: mongoose.Types.ObjectId;
  /**
   * Set when this payment is buying a place in a recurring programme rather
   * than a bare package subscription. Activation then also turns the pending
   * enrollment into a live one and grants its session credits — see
   * CoachSubscriptionPaymentService.applySubscriptionActivation.
   */
  offeringId?: mongoose.Types.ObjectId | null;
  enrollmentId?: mongoose.Types.ObjectId | null;
  merchantOrderId: string;
  phonepeOrderId?: string;
  linkedSubscriptionId?: mongoose.Types.ObjectId | null;
  baseAmount: number;
  platformFeeAmount: number;
  taxAmount: number;
  amount: number;
  status: CoachSubscriptionPaymentStatus;
  state?: string;
  redirectUrl?: string;
  callbackPayload?: Record<string, any>;
  lastStatusPayload?: Record<string, any>;
  /**
   * Refund tracking, deliberately named exactly as on BookingPaymentTransaction.
   * RefundService's logic is generic — it only touches `merchantOrderId` and
   * these fields — so matching the shape lets one refund pipeline serve both
   * kinds of payment instead of a second copy growing beside it.
   */
  refundMerchantId?: string;
  refundId?: string;
  refundState?: string;
  refundAmount?: number;
  refundResponse?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const coachSubscriptionPaymentSchema = new Schema<CoachSubscriptionPaymentDocument>(
  {
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
    dependentId: {
      type: Schema.Types.ObjectId,
      ref: "Player",
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSubscriptionPackage",
      required: true,
      index: true,
    },
    offeringId: {
      type: Schema.Types.ObjectId,
      ref: "CoachOffering",
      default: null,
      index: true,
    },
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: "CoachEnrollment",
      default: null,
      index: true,
    },
    merchantOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phonepeOrderId: {
      type: String,
    },
    linkedSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "CoachSubscription",
      default: null,
    },
    baseAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    platformFeeAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    state: {
      type: String,
    },
    redirectUrl: {
      type: String,
    },
    callbackPayload: {
      type: Schema.Types.Mixed,
    },
    refundMerchantId: { type: String, index: true },
    refundId: { type: String },
    refundState: { type: String },
    refundAmount: { type: Number, min: 0 },
    refundResponse: { type: Schema.Types.Mixed },
    lastStatusPayload: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

coachSubscriptionPaymentSchema.index({ coachId: 1, userId: 1, createdAt: -1 });

export const CoachSubscriptionPaymentTransaction = mongoose.model<CoachSubscriptionPaymentDocument>(
  "CoachSubscriptionPaymentTransaction",
  coachSubscriptionPaymentSchema
);
