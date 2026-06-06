import mongoose, { Document, Schema } from "mongoose";

export interface SubscriptionPlanDocument extends Document {
  academyId: mongoose.Types.ObjectId; // FK -> Academy
  name: string; // e.g., "Monthly Full Access"
  duration: "monthly" | "quarterly" | "annual";
  price: number; // In paise
  includesVenue: boolean;
  includesCoaching: boolean;
  maxSessions: number | null; // null = unlimited
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    academyId: {
      type: Schema.Types.ObjectId,
      ref: "Academy",
      required: [true, "Academy ID is required"],
    },
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    duration: {
      type: String,
      enum: ["monthly", "quarterly", "annual"],
      required: [true, "Duration is required"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be non-negative"],
    },
    includesVenue: {
      type: Boolean,
      default: false,
    },
    includesCoaching: {
      type: Boolean,
      default: true,
    },
    maxSessions: {
      type: Number,
      default: null, // null means unlimited
      min: [1, "Max sessions must be at least 1"],
    },
    description: {
      type: String,
      default: "",
      maxlength: [150, "Description cannot exceed 150 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Create indexes for common queries
subscriptionPlanSchema.index({ academyId: 1 });
subscriptionPlanSchema.index({ academyId: 1, isActive: 1 });

const SubscriptionPlan =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<SubscriptionPlanDocument>(
    "SubscriptionPlan",
    subscriptionPlanSchema,
  );

export default SubscriptionPlan;
