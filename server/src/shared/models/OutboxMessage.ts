import mongoose from "mongoose";

export type OutboxStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

const OutboxMessageSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, required: true, default: "PENDING" },
    attempts: { type: Number, required: true, default: 0 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

OutboxMessageSchema.index({ status: 1, nextAttemptAt: 1 });

const OutboxMessage = mongoose.model("OutboxMessage", OutboxMessageSchema);

export default OutboxMessage;
