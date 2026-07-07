import mongoose, { Document, Schema } from "mongoose";

export interface DisputeDocument extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
  disputeDetails?: string;
  status: "OPEN" | "RESOLVED" | "CLOSED";
  resolutionMethod?: "AUTO" | "MANUAL";
  recommendedAction?:
    "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND" | "MANUAL_REVIEW";
  refundPercentage?: number;
  reasoning?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  requiresManualReview?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const disputeSchema = new Schema<DisputeDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    disputeType: {
      type: String,
      enum: ["NO_SHOW", "POOR_QUALITY", "PAYMENT_ISSUE", "OTHER"],
      required: true,
      index: true,
    },
    disputeDetails: {
      type: String,
    },
    status: {
      type: String,
      enum: ["OPEN", "RESOLVED", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    resolutionMethod: {
      type: String,
      enum: ["AUTO", "MANUAL"],
    },
    recommendedAction: {
      type: String,
      enum: ["FULL_REFUND", "PARTIAL_REFUND", "NO_REFUND", "MANUAL_REVIEW"],
    },
    refundPercentage: {
      type: Number,
      default: 0,
    },
    reasoning: {
      type: String,
    },
    confidence: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
    },
    requiresManualReview: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const Dispute = mongoose.model<DisputeDocument>(
  "Dispute",
  disputeSchema,
);
