import mongoose, { Document, Schema } from "mongoose";

export interface SessionPackageDocument extends Document {
  academyId: mongoose.Types.ObjectId; // FK -> Academy
  name: string; // e.g., "10 Session Bundle"
  sessionCount: number;
  price: number; // In paise
  validityDays: number;
  sport: string;
  coachId?: mongoose.Types.ObjectId; // Optional - for specific coach package
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sessionPackageSchema = new Schema<SessionPackageDocument>(
  {
    academyId: {
      type: Schema.Types.ObjectId,
      ref: "Academy",
      required: [true, "Academy ID is required"],
    },
    name: {
      type: String,
      required: [true, "Package name is required"],
      trim: true,
    },
    sessionCount: {
      type: Number,
      required: [true, "Session count is required"],
      min: [1, "Session count must be at least 1"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be non-negative"],
    },
    validityDays: {
      type: Number,
      required: [true, "Validity period is required"],
      min: [1, "Validity must be at least 1 day"],
    },
    sport: {
      type: String,
      required: [true, "Sport is required"],
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
      optional: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Create indexes for common queries
sessionPackageSchema.index({ academyId: 1 });
sessionPackageSchema.index({ academyId: 1, isActive: 1 });
sessionPackageSchema.index({ sport: 1 });

const SessionPackage =
  mongoose.models.SessionPackage ||
  mongoose.model<SessionPackageDocument>(
    "SessionPackage",
    sessionPackageSchema,
  );

export default SessionPackage;
