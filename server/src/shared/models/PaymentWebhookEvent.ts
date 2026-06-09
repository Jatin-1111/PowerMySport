import mongoose from "mongoose";

const PaymentWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "DONE", "FAILED"],
      default: "PENDING",
    },
    attempts: { type: Number, default: 0 },
    receivedAt: { type: Date, default: () => new Date() },
    processedAt: { type: Date },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

const PaymentWebhookEvent = mongoose.model(
  "PaymentWebhookEvent",
  PaymentWebhookEventSchema,
);

export default PaymentWebhookEvent;
