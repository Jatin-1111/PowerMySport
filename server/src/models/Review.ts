import mongoose, { Schema, Document } from "mongoose";

export interface ReviewDocument extends Document {
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // Reviewer (player)
  venueId: mongoose.Types.ObjectId;
  coachId?: mongoose.Types.ObjectId;

  // Ratings (1-5)
  venueRating: number;
  coachRating?: number;

  // Reviews
  venueReview?: string;
  coachReview?: string;

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
      unique: true, // One review per booking
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    venueId: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: "Coach",
    },
    venueRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    coachRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    venueReview: {
      type: String,
      maxlength: 1000,
    },
    coachReview: {
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
reviewSchema.index({ venueId: 1, createdAt: -1 });
reviewSchema.index({ coachId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });
reviewSchema.index({ bookingId: 1 });

export const Review = mongoose.model<ReviewDocument>("Review", reviewSchema);
