import mongoose, { Document, Schema } from "mongoose";

export interface EmailVerificationDocument extends Document {
  email: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailVerificationSchema = new Schema<EmailVerificationDocument>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// TTL index to auto-delete expired verification codes after they expire
emailVerificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 3600, name: "verification_ttl" }, // Delete 1 hour after expiry
);

// Index for fast lookups
emailVerificationSchema.index({ email: 1, verified: 1 });

export const EmailVerification = mongoose.model<EmailVerificationDocument>(
  "EmailVerification",
  emailVerificationSchema,
);
