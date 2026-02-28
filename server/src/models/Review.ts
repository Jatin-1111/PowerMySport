import mongoose, { Schema, Document } from "mongoose";

export interface ReviewDocument extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Reviewer (player)
  targetType: "VENUE" | "COACH";
  targetId: mongoose.Types.ObjectId;

  // Ratings (1-5)
  rating: number;

  // Reviews
  review?: string;

  // Metadata
  isVerified: boolean; // Only from COMPLETED bookings
  helpfulCount: number;
  reportCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewDocument>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["VENUE", "COACH"],
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
  },
  { timestamps: true },
);

// Indexes
reviewSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ bookingId: 1, targetType: 1 }, { unique: true });

export const Review = mongoose.model<ReviewDocument>("Review", reviewSchema);
