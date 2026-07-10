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
  "PENDING_PAYMENT" | "PAID" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type ExpertSessionCanceller = "CLIENT" | "EXPERT" | "ADMIN" | "SYSTEM";
export type ExpertRefundStatus = "NONE" | "REQUIRED" | "MANUAL_DONE";
/** Whether the expert has confirmed the client's booked time. */
export type ExpertAcceptance = "PENDING" | "ACCEPTED" | "DECLINED";
/**
 * PENDING until the 24h post-completion release job (or an admin override) flips
 * it to PAID once the expert has actually been paid out.
 */
export type ExpertPayoutStatus = "PENDING" | "PAID";

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
  // Hours of notice given before scheduledAt when a paid session was cancelled
  // (negative if cancelled after the scheduled time). Informational only — used
  // by admin to decide whether a refund is warranted; the app never auto-forfeits.
  cancellationNoticeHours?: number;
  autoCompleted?: boolean;
  // Expert confirmation of the booked time
  expertAcceptance: ExpertAcceptance;
  expertRespondedAt?: Date;
  // Set when status transitions to COMPLETED (manual or auto) — the anchor for
  // the 24h payout-release window (deliberately NOT `updatedAt`, which a later
  // review submission would otherwise bump).
  completedAt?: Date;
  payoutStatus: ExpertPayoutStatus;
  payoutPaidAt?: Date;
  // Review
  reviewed: boolean;
  rating?: number;
  review?: string;
  reviewAnonymous?: boolean;
  reviewHidden?: boolean;
  reviewedAt?: Date;
  reviewReminderSentAt?: Date;
  // Session-connection reminders (both one-shot, deduped by these timestamps)
  /** Nudge sent to the EXPERT to add a meeting link when an ONLINE session is starting soon and still has none. */
  meetingLinkNudgeSentAt?: Date;
  /** "Your session starts soon" reminder sent to both parties with the link/address. */
  startReminderSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const expertSessionSchema = new Schema<ExpertSessionDocument>(
  {
    expertId: {
      type: Schema.Types.ObjectId,
      ref: "Expert",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
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
    merchantOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phonepeOrderId: { type: String },
    scheduledAt: { type: Date, index: true },
    durationMinutes: { type: Number, default: 60, min: 15, max: 480 },
    holdExpiresAt: { type: Date },
    mode: { type: String, enum: ["ONLINE", "IN_PERSON"] },
    meetingLink: { type: String, trim: true },
    clientNote: { type: String, trim: true, maxlength: 1000 },
    callbackPayload: { type: Schema.Types.Mixed },
    cancelledAt: { type: Date },
    cancelledBy: {
      type: String,
      enum: ["CLIENT", "EXPERT", "ADMIN", "SYSTEM"],
    },
    cancelReason: { type: String, trim: true, maxlength: 1000 },
    refundStatus: {
      type: String,
      enum: ["NONE", "REQUIRED", "MANUAL_DONE"],
      default: "NONE",
      index: true,
    },
    cancellationNoticeHours: { type: Number },
    autoCompleted: { type: Boolean, default: false },
    expertAcceptance: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED"],
      default: "PENDING",
      index: true,
    },
    expertRespondedAt: { type: Date },
    completedAt: { type: Date },
    payoutStatus: {
      type: String,
      enum: ["PENDING", "PAID"],
      default: "PENDING",
      index: true,
    },
    payoutPaidAt: { type: Date },
    reviewed: { type: Boolean, default: false },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 2000 },
    reviewAnonymous: { type: Boolean, default: false },
    reviewHidden: { type: Boolean, default: false },
    reviewedAt: { type: Date },
    reviewReminderSentAt: { type: Date },
    meetingLinkNudgeSentAt: { type: Date },
    startReminderSentAt: { type: Date },
  },
  { timestamps: true },
);

expertSessionSchema.index({ expertId: 1, status: 1, createdAt: -1 });
expertSessionSchema.index({ userId: 1, createdAt: -1 });
// Supports slot-conflict lookups for a given expert around a time.
expertSessionSchema.index({ expertId: 1, scheduledAt: 1, status: 1 });
// Supports the payout-release job's scan for completed-but-unpaid sessions.
expertSessionSchema.index({ status: 1, payoutStatus: 1, completedAt: 1 });
// Supports the connection-reminder jobs' scan for SCHEDULED sessions starting soon.
expertSessionSchema.index({ status: 1, scheduledAt: 1 });

export const ExpertSession =
  mongoose.models.ExpertSession ||
  mongoose.model<ExpertSessionDocument>("ExpertSession", expertSessionSchema);
