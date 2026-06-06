import mongoose, { Document, Schema } from "mongoose";

export type CoachPlanBillingCycle = "MONTHLY" | "YEARLY";

export interface CoachPlanPricing {
  monthly?: number;
  yearly?: number;
}

export interface CoachPlanDocument extends Document {
  id?: string;
  code: string;
  name: string;
  description?: string;
  pricing: CoachPlanPricing;
  features: string[];
  isActive: boolean;
  supportsOverrides: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const coachPlanSchema = new Schema<CoachPlanDocument>(
  {
    code: {
      type: String,
      required: [true, "Plan code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    pricing: {
      monthly: {
        type: Number,
        min: [0, "Monthly price must be a positive number"],
      },
      yearly: {
        type: Number,
        min: [0, "Yearly price must be a positive number"],
      },
    },
    features: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    supportsOverrides: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

coachPlanSchema.virtual("id").get(function (this: CoachPlanDocument) {
  return this._id.toString();
});

coachPlanSchema.index({ code: 1 }, { unique: true });
coachPlanSchema.index({ isActive: 1 });

export const CoachPlan = mongoose.model<CoachPlanDocument>(
  "CoachPlan",
  coachPlanSchema,
);
