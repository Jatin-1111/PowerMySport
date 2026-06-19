import mongoose, { Schema, Document } from "mongoose";

export interface ReviewDocument extends Document {
  bookingId?: mongoose.Types.ObjectId; // For venues/coaches
  orderId?: mongoose.Types.ObjectId; // For products
  userId: mongoose.Types.ObjectId; // Reviewer (player)
  targetType: "VENUE" | "COACH" | "PRODUCT";
  targetId: mongoose.Types.ObjectId;

  // Ratings (1-5)
  rating: number;

  // Reviews
  review?: string;

  // Metadata
  isVerified: boolean; // Only from COMPLETED bookings
  helpfulCount: number;
  reportCount: number;
  isHidden: boolean; // Hidden by moderators
  moderationStatus: "PENDING" | "APPROVED" | "FLAGGED" | "REMOVED";
  moderationNotes?: string;
  reports: Array<{
    userId: mongoose.Types.ObjectId;
    reason: string;
    reportedAt: Date;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["VENUE", "COACH", "PRODUCT"],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      maxlength: 1000,
    },
    isVerified: {
      type: Boolean,
      default: true, // From completed bookings
    },
    helpfulCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    moderationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "FLAGGED", "REMOVED"],
      default: "APPROVED",
    },
    moderationNotes: {
      type: String,
    },
    reports: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reason: {
          type: String,
          required: true,
          maxlength: 500,
        },
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

// Indexes
reviewSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ moderationStatus: 1, reportCount: -1 });
// Allow multiple reviews per booking (one for venue, one for coach)
reviewSchema.index(
  { bookingId: 1, targetType: 1, userId: 1 },
  { unique: true, sparse: true },
);
// Allow one review per product per order
reviewSchema.index(
  { orderId: 1, targetType: 1, targetId: 1, userId: 1 },
  { unique: true, sparse: true },
);

export const Review = mongoose.model<ReviewDocument>("Review", reviewSchema);
