import mongoose, { Document, Schema } from "mongoose";

/**
 * A paid 1:1 session between a client (User) and an Expert.
 * Flow: PENDING_PAYMENT (slot held) → (PhonePe) SCHEDULED (slot confirmed) →
 * COMPLETED → client can leave a rating/review (stored on this document).
 * Unpaid holds expire (→ CANCELLED) so the slot frees up; scheduled sessions
 * auto-complete once their end time passes.
 * (File is named ExpertBooking.ts; the Mongoose model name is "ExpertSession".)
 */
export type ExpertSessionStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export type ExpertSessionCanceller = "CLIENT" | "EXPERT" | "ADMIN" | "SYSTEM";
export type ExpertRefundStatus = "NONE" | "REQUIRED" | "MANUAL_DONE";
/** Whether the expert has confirmed the client's booked time. */
export type ExpertAcceptance = "PENDING" | "ACCEPTED" | "DECLINED";

export interface ExpertSessionDocument extends Document {
  expertId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  status: ExpertSessionStatus;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  merchantOrderId: string;
  phonepeOrderId?: string;
  scheduledAt?: Date;
  durationMinutes: number;
  holdExpiresAt?: Date; // while PENDING_PAYMENT, the slot hold expiry
  mode?: "ONLINE" | "IN_PERSON";
  meetingLink?: string;
  clientNote?: string;
  callbackPayload?: unknown;
  // Cancellation
  cancelledAt?: Date;
  cancelledBy?: ExpertSessionCanceller;
  cancelReason?: string;
  refundStatus: ExpertRefundStatus;
  autoCompleted?: boolean;
  // Expert confirmation of the booked time
  expertAcceptance: ExpertAcceptance;
  expertRespondedAt?: Date;
  // Review
  reviewed: boolean;
  rating?: number;
  review?: string;
  reviewAnonymous?: boolean;
  reviewHidden?: boolean;
  reviewedAt?: Date;
  reviewReminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const expertSessionSchema = new Schema<ExpertSessionDocument>(
  {
    expertId: { type: Schema.Types.ObjectId, ref: "Expert", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "PAID", "SCHEDULED", "COMPLETED", "CANCELLED"],
      default: "PENDING_PAYMENT",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    merchantOrderId: { type: String, required: true, unique: true, index: true },
    phonepeOrderId: { type: String },
    scheduledAt: { type: Date, index: true },
    durationMinutes: { type: Number, default: 60, min: 15, max: 480 },
    holdExpiresAt: { type: Date },
    mode: { type: String, enum: ["ONLINE", "IN_PERSON"] },
    meetingLink: { type: String, trim: true },
    clientNote: { type: String, trim: true, maxlength: 1000 },
    callbackPayload: { type: Schema.Types.Mixed },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ["CLIENT", "EXPERT", "ADMIN", "SYSTEM"] },
    cancelReason: { type: String, trim: true, maxlength: 1000 },
    refundStatus: {
      type: String,
      enum: ["NONE", "REQUIRED", "MANUAL_DONE"],
      default: "NONE",
      index: true,
    },
    autoCompleted: { type: Boolean, default: false },
    expertAcceptance: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED"],
      default: "PENDING",
      index: true,
    },
    expertRespondedAt: { type: Date },
    reviewed: { type: Boolean, default: false },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 2000 },
    reviewAnonymous: { type: Boolean, default: false },
    reviewHidden: { type: Boolean, default: false },
    reviewedAt: { type: Date },
    reviewReminderSentAt: { type: Date },
  },
  { timestamps: true },
);

expertSessionSchema.index({ expertId: 1, status: 1, createdAt: -1 });
expertSessionSchema.index({ userId: 1, createdAt: -1 });
// Supports slot-conflict lookups for a given expert around a time.
expertSessionSchema.index({ expertId: 1, scheduledAt: 1, status: 1 });

export const ExpertSession =
  mongoose.models.ExpertSession ||
  mongoose.model<ExpertSessionDocument>("ExpertSession", expertSessionSchema);
