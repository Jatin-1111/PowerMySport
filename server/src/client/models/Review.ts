import mongoose, { Schema, Document } from "mongoose";
import { REVIEW_UNIQUE_INDEXES } from "./reviewIndexes";

export interface ReviewDocument extends Document {
  bookingId?: mongoose.Types.ObjectId; // For venues/coaches
  orderId?: mongoose.Types.ObjectId; // For products
  userId: mongoose.Types.ObjectId; // Reviewer (player)
  targetType: "VENUE" | "Coach" | "ACADEMY" | "EXPERT" | "PRODUCT";
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
  /**
   * The reviewer asked not to be named publicly. Carried over from
   * ExpertSession.reviewAnonymous when expert reviews moved off the session
   * document — without it, unifying reviews would silently expose reviewers
   * who had opted out.
   */
  isAnonymous?: boolean;
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
      // ACADEMY and EXPERT added when expert reviews moved off ExpertSession —
      // reviews for every provider type now live in this one collection.
      enum: ["VENUE", "Coach", "ACADEMY", "EXPERT", "PRODUCT"],
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
    isAnonymous: {
      type: Boolean,
      default: false,
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
  { timestamps: true }
);

// Indexes
reviewSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1 });
// Backs getFlaggedReviews' moderation queue — {moderationStatus:$in} + sort
// {reportCount:-1, createdAt:-1}. The index above has no createdAt tiebreak.
// Production has autoIndex off, so this also needs migration 35.
reviewSchema.index({ moderationStatus: 1, reportCount: -1, createdAt: -1 });
// The unique rules (one review per user per booking per target, per order per
// product, per user per product) live in reviewIndexes.ts so migration 50 and
// this model share one definition. They are PARTIAL on purpose: the sparse
// versions that used to be here still indexed bookingless reviews, so only one
// product review could ever exist and nobody could review a venue twice.
// Production has autoIndex off, so changing these needs migration 50.
for (const { key, ...options } of REVIEW_UNIQUE_INDEXES) {
  reviewSchema.index(key, options);
}

export const Review = mongoose.model<ReviewDocument>("Review", reviewSchema);
