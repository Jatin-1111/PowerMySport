import mongoose, { Document, Schema } from "mongoose";

export interface RateLimitDocument extends Document {
  key: string; // email or identifier
  type: string; // "EMAIL_VERIFICATION", "LOGIN", etc.
  count: number;
  resetAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const rateLimitSchema = new Schema<RateLimitDocument>(
  {
    key: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["EMAIL_VERIFICATION", "LOGIN", "API"],
    },
    count: {
      type: Number,
      default: 1,
      min: 0,
    },
    resetAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index for key + type
rateLimitSchema.index(
  { key: 1, type: 1 },
  { unique: true, name: "unique_rate_limit" },
);

// TTL index to auto-delete after reset time
rateLimitSchema.index(
  { resetAt: 1 },
  { expireAfterSeconds: 0, name: "rate_limit_ttl" },
);

export const RateLimit = mongoose.model<RateLimitDocument>(
  "RateLimit",
  rateLimitSchema,
);
