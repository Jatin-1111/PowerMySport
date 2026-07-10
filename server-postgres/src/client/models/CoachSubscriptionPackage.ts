import mongoose, { Document, Schema } from "mongoose";

export type SubscriptionFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface CoachSubscriptionPackageDocument extends Document {
  id?: string;
  coachId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  frequency: SubscriptionFrequency;
  price: number; // In paise
  features: string[];
  maxStudents?: number | null; // null = unlimited
  maxSessions?: number | null; // null = unlimited
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const coachSubscriptionPackageSchema =
  new Schema<CoachSubscriptionPackageDocument>(
    {
      coachId: {
        type: Schema.Types.ObjectId,
        ref: "Coach",
        required: [true, "Coach ID is required"],
        index: true,
      },
      name: {
        type: String,
        required: [true, "Package name is required"],
        trim: true,
      },
      description: {
        type: String,
        default: "",
        trim: true,
        maxlength: [500, "Description cannot exceed 500 characters"],
      },
      frequency: {
        type: String,
        enum: ["MONTHLY", "QUARTERLY", "YEARLY"],
        required: [true, "Billing frequency is required"],
      },
      price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price must be non-negative"],
      },
      features: {
        type: [String],
        default: [],
        validate: {
          validator: function (v: string[]) {
            return Array.isArray(v) && v.every((f) => typeof f === "string");
          },
          message: "Features must be an array of strings",
        },
      },
      maxStudents: {
        type: Number,
        default: null, // null means unlimited
        min: [1, "Max students must be at least 1"],
        validate: {
          validator: function (v: number | null) {
            return v === null || v >= 1;
          },
          message: "Max students must be null (unlimited) or >= 1",
        },
      },
      maxSessions: {
        type: Number,
        default: null, // null means unlimited
        min: [1, "Max sessions must be at least 1"],
        validate: {
          validator: function (v: number | null) {
            return v === null || v >= 1;
          },
          message: "Max sessions must be null (unlimited) or >= 1",
        },
      },
      isActive: {
        type: Boolean,
        default: true,
        index: true,
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

coachSubscriptionPackageSchema.virtual("id").get(function (
  this: CoachSubscriptionPackageDocument,
) {
  return this._id.toString();
});

// Compound index for common queries
coachSubscriptionPackageSchema.index({ coachId: 1, isActive: 1 });
coachSubscriptionPackageSchema.index({ coachId: 1, frequency: 1 });

export const CoachSubscriptionPackage =
  mongoose.model<CoachSubscriptionPackageDocument>(
    "CoachSubscriptionPackage",
    coachSubscriptionPackageSchema,
  );
