import mongoose, { Document, Schema } from "mongoose";

/**
 * A paid 1:1 session between a client (User) and an Expert.
 * Flow: PENDING_PAYMENT → (PhonePe) PAID → (client picks time) SCHEDULED →
 * COMPLETED → client can leave a rating/review (stored on this document).
 * (File is named ExpertBooking.ts; the Mongoose model name is "ExpertSession".)
 */
export type ExpertSessionStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

export interface ExpertSessionDocument extends Document {
  expertId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  status: ExpertSessionStatus;
  paymentStatus: "PENDING" | "COMPLETED" | "FAILED";
  merchantOrderId: string;
  phonepeOrderId?: string;
  scheduledAt?: Date;
  mode?: "ONLINE" | "IN_PERSON";
  meetingLink?: string;
  clientNote?: string;
  reviewed: boolean;
  rating?: number;
  review?: string;
  reviewedAt?: Date;
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
    scheduledAt: { type: Date },
    mode: { type: String, enum: ["ONLINE", "IN_PERSON"] },
    meetingLink: { type: String },
    clientNote: { type: String, trim: true, maxlength: 1000 },
    reviewed: { type: Boolean, default: false },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String, trim: true, maxlength: 2000 },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

expertSessionSchema.index({ expertId: 1, status: 1, createdAt: -1 });
expertSessionSchema.index({ userId: 1, createdAt: -1 });

export const ExpertSession =
  mongoose.models.ExpertSession ||
  mongoose.model<ExpertSessionDocument>("ExpertSession", expertSessionSchema);
