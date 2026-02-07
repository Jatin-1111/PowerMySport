import mongoose, { Schema, Document } from "mongoose";

export interface PromoCodeDocument extends Document {
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number; // Percentage (1-100) or fixed amount

  // Applicability
  applicableTo: "ALL" | "VENUE_ONLY" | "COACH_ONLY";
  minBookingAmount?: number;
  maxDiscountAmount?: number; // Cap for percentage discounts

  // Validity
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;

  // Usage limits
  maxUsageTotal?: number; // Total times code can be used
  maxUsagePerUser?: number; // Per user limit
  currentUsageCount: number;

  // Tracking
  usedBy: Array<{
    userId: mongoose.Types.ObjectId;
    bookingId: mongoose.Types.ObjectId;
    discountApplied: number;
    usedAt: Date;
  }>;

  createdBy: mongoose.Types.ObjectId; // Admin who created it
  createdAt: Date;
  updatedAt: Date;
}

const promoCodeSchema = new Schema<PromoCodeDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED_AMOUNT"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    applicableTo: {
      type: String,
      enum: ["ALL", "VENUE_ONLY", "COACH_ONLY"],
      default: "ALL",
    },
    minBookingAmount: {
      type: Number,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    maxUsageTotal: {
      type: Number,
      min: 0,
    },
    maxUsagePerUser: {
      type: Number,
      min: 0,
      default: 1,
    },
    currentUsageCount: {
      type: Number,
      default: 0,
    },
    usedBy: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        bookingId: {
          type: Schema.Types.ObjectId,
          ref: "Booking",
          required: true,
        },
        discountApplied: {
          type: Number,
          required: true,
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

// Indexes
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, validUntil: 1 });

export const PromoCode = mongoose.model<PromoCodeDocument>(
  "PromoCode",
  promoCodeSchema,
);
