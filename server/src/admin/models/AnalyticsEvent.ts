import mongoose, { Document, Schema } from "mongoose";

export interface AnalyticsEventDocument extends Document {
  userId?: mongoose.Types.ObjectId;
  eventName: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  source: "WEB" | "MOBILE" | "SERVER";
  createdAt: Date;
  updatedAt: Date;
}

const analyticsEventSchema = new Schema<AnalyticsEventDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    eventName: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, trim: true },
    entityId: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    source: {
      type: String,
      enum: ["WEB", "MOBILE", "SERVER"],
      default: "WEB",
      index: true,
    },
  },
  { timestamps: true },
);

analyticsEventSchema.index({ eventName: 1, createdAt: -1 });
analyticsEventSchema.index({ userId: 1, createdAt: -1 });
// Allows the funnel $match { createdAt: { $gte: ... } } to use an index scan
analyticsEventSchema.index({ createdAt: -1 });

export const AnalyticsEvent = mongoose.model<AnalyticsEventDocument>(
  "AnalyticsEvent",
  analyticsEventSchema,
);
