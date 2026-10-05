import mongoose, { Document, Schema } from "mongoose";
import { GUEST_EVENT_TTL_INDEX } from "./analyticsEventIndexes";

export interface AnalyticsEventDocument extends Document {
  userId?: mongoose.Types.ObjectId;
  // Pseudonymous, randomly-generated id for not-signed-in visitors. Never
  // contains personal data — it only lets us count and group anonymous
  // activity (e.g. "how many distinct visitors opened this page").
  guestId?: string;
  eventName: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  source: "WEB" | "MOBILE" | "SERVER";
  createdAt: Date;
  updatedAt: Date;
}

// No `index: true` on userId / guestId / eventName / source: each is the leading
// key of a compound index below, or too low in cardinality to help. The
// single-field versions were pure write amplification (see
// analyticsEventIndexes.ts). Production has autoIndex off, so removing them
// there needs migration 51.
const analyticsEventSchema = new Schema<AnalyticsEventDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    guestId: { type: String, trim: true },
    eventName: { type: String, required: true, trim: true },
    entityType: { type: String, trim: true },
    entityId: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    source: {
      type: String,
      enum: ["WEB", "MOBILE", "SERVER"],
      default: "WEB",
    },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ eventName: 1, createdAt: -1 });
analyticsEventSchema.index({ userId: 1, createdAt: -1 });
// Allows the funnel $match { createdAt: { $gte: ... } } to use an index scan
analyticsEventSchema.index({ createdAt: -1 });
// Guest activity queries filter on guestId + createdAt
analyticsEventSchema.index({ guestId: 1, createdAt: -1 });
// Retention for the public guest ingest: guest events expire after 90 days.
// Partial on guestId, so signed-in funnel events and unsupported_sport_search
// (which the admin reads up to 365 days back) are not touched. See
// analyticsEventIndexes.ts. Needs migration 51 in production.
{
  const { key, ...options } = GUEST_EVENT_TTL_INDEX;
  analyticsEventSchema.index(key, options);
}

export const AnalyticsEvent = mongoose.model<AnalyticsEventDocument>(
  "AnalyticsEvent",
  analyticsEventSchema
);
