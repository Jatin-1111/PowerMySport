import mongoose, { Document, Schema } from "mongoose";

export type BookingPaymentTransactionStatus =
  "PENDING" | "COMPLETED" | "FAILED";

export interface BookingPaymentTransactionDocument extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  merchantOrderId: string;
  phonepeOrderId?: string;
  amount: number;
  status: BookingPaymentTransactionStatus;
  state?: string;
  redirectUrl?: string;
  callbackPayload?: Record<string, any>;
  lastStatusPayload?: Record<string, any>;
  refundMerchantId?: string;
  refundId?: string;
  refundState?: string;
  refundAmount?: number;
  refundResponse?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const bookingPaymentTransactionSchema =
  new Schema<BookingPaymentTransactionDocument>(
    {
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
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
      lastStatusPayload: {
        type: Schema.Types.Mixed,
      },
      refundMerchantId: {
        type: String,
      },
      refundId: {
        type: String,
      },
      refundState: {
        type: String,
      },
      refundAmount: {
        type: Number,
        min: 0,
      },
      refundResponse: {
        type: Schema.Types.Mixed,
      },
    },
    { timestamps: true },
  );

bookingPaymentTransactionSchema.index({ bookingId: 1, userId: 1 });

export const BookingPaymentTransaction =
  mongoose.model<BookingPaymentTransactionDocument>(
    "BookingPaymentTransaction",
    bookingPaymentTransactionSchema,
  );
