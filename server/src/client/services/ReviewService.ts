import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { Coach } from "../models/Coach";
import { Review, ReviewDocument } from "../models/Review";
import { Venue } from "../models/Venue";
import { User } from "../models/User";
import { sendReviewReceivedEmail } from "../../utils/email";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("review");

export interface CreateReviewPayload {
  bookingId: string;
  userId: string;
  targetType: "VENUE" | "Coach";
  rating: number;
  review?: string;
}

/**
 * Create a review for a completed booking
 * Allows separate reviews for venue and coach
 * Only allows reviews for COMPLETED bookings
 * Updates venue and coach average ratings
 */
export const createReview = async (payload: CreateReviewPayload): Promise<ReviewDocument> => {
  // Verify booking exists and is completed
  const booking = await Booking.findById(payload.bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "COMPLETED") {
    throw new Error("Can only review completed bookings");
  }

  if (booking.userId.toString() !== payload.userId) {
    throw new Error("You can only review your own bookings");
  }

  // Determine target ID based on target type
  let targetId;
  if (payload.targetType === "VENUE") {
    if (!booking.venueId) {
      throw new Error("This booking has no venue to review");
    }
    targetId = booking.venueId;
  } else if (payload.targetType === "Coach") {
    if (!booking.coachId) {
      throw new Error("This booking has no coach to review");
    }
    targetId = booking.coachId;
  } else {
    throw new Error("Invalid target type");
  }

  // Check if review already exists for this specific target
  const existingReview = await Review.findOne({
    bookingId: payload.bookingId,
    targetType: payload.targetType,
    userId: payload.userId,
  });

  if (existingReview) {
    throw new Error(`You have already reviewed this ${payload.targetType.toLowerCase()}`);
  }

  // Validate rating
  if (payload.rating < 1 || payload.rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  // Create review
  const review = new Review({
    bookingId: payload.bookingId,
    userId: payload.userId,
    targetType: payload.targetType,
    targetId,
    rating: payload.rating,
    review: payload.review,
    isVerified: true, // From completed booking
  });

  await review.save();

  // Update venue or coach rating
  if (payload.targetType === "VENUE") {
    await recomputeVenueRating(targetId.toString());
  } else if (payload.targetType === "Coach") {
    await recomputeCoachRating(targetId.toString());
  }

  // Notify the provider of the new review (fire-and-forget).
  void (async () => {
    try {
      const reviewer = await User.findById(payload.userId).select("name").lean();
      let providerEmail: string | undefined;
      let providerName: string | undefined;
      if (payload.targetType === "VENUE") {
        const venue = await Venue.findById(targetId).populate("ownerId", "name email").lean();
        const owner = venue?.ownerId as unknown as {
          name?: string;
          email?: string;
        } | null;
        providerEmail = owner?.email;
        providerName = owner?.name;
      } else {
        const coach = await Coach.findById(targetId).populate("userId", "name email").lean();
        const coachUser = coach?.userId as unknown as {
          name?: string;
          email?: string;
        } | null;
        providerEmail = coachUser?.email;
        providerName = coachUser?.name;
      }
      if (providerEmail) {
        await sendReviewReceivedEmail({
          name: providerName,
          email: providerEmail,
          rating: payload.rating,
          review: payload.review,
          reviewerName: reviewer?.name,
          targetType: payload.targetType,
        });
      }
    } catch (emailError) {
      log.error("Failed to send review email:", emailError);
    }
  })();

  return review;
};

/**
 * A review counts toward a provider's rating only while the public can see it.
 * The public lists already filter on these two fields (see getVenueReviews);
 * the headline rating did not, so a removed one-star review kept dragging a
 * coach or venue down and the star count and the list disagreed.
 */
const COUNTS_TOWARD_RATING = {
  isHidden: { $ne: true },
  moderationStatus: { $ne: "REMOVED" },
};

/**
 * Average rating and review count from the reviews the public can see. Zero
 * when none are left, so hiding the last review does not leave the old rating
 * standing.
 */
const visibleRatingStats = async (
  targetType: "VENUE" | "Coach",
  targetId: string
): Promise<{ rating: number; reviewCount: number }> => {
  const [stats] = await Review.aggregate([
    {
      $match: {
        targetType,
        targetId: new mongoose.Types.ObjectId(targetId),
        ...COUNTS_TOWARD_RATING,
      },
    },
    { $group: { _id: null, averageRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
  ]);
  return { rating: stats?.averageRating || 0, reviewCount: stats?.reviewCount || 0 };
};

/** Update a venue's average rating and review count. */
export const recomputeVenueRating = async (venueId: string): Promise<void> => {
  await Venue.findByIdAndUpdate(venueId, await visibleRatingStats("VENUE", venueId));
};

/** Update a coach's average rating and review count. */
export const recomputeCoachRating = async (coachId: string): Promise<void> => {
  if (!coachId) return;
  await Coach.findByIdAndUpdate(coachId, await visibleRatingStats("Coach", coachId));
};

/**
 * Get reviews for a venue
 */
export const getVenueReviews = async (
  venueId: string,
  page: number = 1,
  limit: number = 10
): Promise<{
  reviews: ReviewDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const query = {
    targetType: "VENUE" as const,
    targetId: venueId,
    isHidden: false,
    moderationStatus: { $ne: "REMOVED" },
  };

  const total = await Review.countDocuments(query);
  const reviews = await Review.find(query)
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Get reviews for a coach
 */
export const getCoachReviews = async (
  coachId: string,
  page: number = 1,
  limit: number = 10
): Promise<{
  reviews: ReviewDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const query = {
    targetType: "Coach" as const,
    targetId: coachId,
    isHidden: false,
    moderationStatus: { $ne: "REMOVED" },
  };

  const total = await Review.countDocuments(query);
  const reviews = await Review.find(query)
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Mark review as helpful
 */
export const markReviewHelpful = async (reviewId: string): Promise<ReviewDocument | null> => {
  return Review.findByIdAndUpdate(reviewId, { $inc: { helpfulCount: 1 } }, { new: true });
};

/**
 * Report a review with reason (for moderation)
 */
export const reportReview = async (
  reviewId: string,
  userId: string,
  reason: string
): Promise<ReviewDocument | null> => {
  const review = await Review.findById(reviewId);

  if (!review) {
    throw new Error("Review not found");
  }

  // Check if user already reported this review
  const alreadyReported = review.reports?.some((report) => report.userId.toString() === userId);

  if (alreadyReported) {
    throw new Error("You have already reported this review");
  }

  // Add report and increment count
  const updatedReview = await Review.findByIdAndUpdate(
    reviewId,
    {
      $inc: { reportCount: 1 },
      $push: {
        reports: {
          userId,
          reason,
          reportedAt: new Date(),
        },
      },
      // Auto-flag if 3+ reports
      $set: {
        moderationStatus: review.reportCount + 1 >= 3 ? "FLAGGED" : review.moderationStatus,
      },
    },
    { new: true }
  );

  return updatedReview;
};

/**
 * Get flagged reviews for moderation (admin only)
 */
export const getFlaggedReviews = async (
  page: number = 1,
  limit: number = 20
): Promise<{
  reviews: ReviewDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;
  const query = { moderationStatus: { $in: ["FLAGGED", "PENDING"] } };

  // Independent reads — no data dependency between the count and the page.
  const [total, reviews] = await Promise.all([
    Review.countDocuments(query),
    Review.find(query)
      .populate("userId", "name email")
      .populate("targetId", "name")
      .sort({ reportCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Moderate a review (admin only)
 */
export const moderateReview = async (
  reviewId: string,
  action: "APPROVE" | "REMOVE" | "HIDE",
  moderationNotes?: string
): Promise<ReviewDocument | null> => {
  const update: any = {
    moderationNotes,
  };

  if (action === "APPROVE") {
    update.moderationStatus = "APPROVED";
    update.isHidden = false;
  } else if (action === "REMOVE") {
    update.moderationStatus = "REMOVED";
    update.isHidden = true;
  } else if (action === "HIDE") {
    update.isHidden = true;
  }

  const moderated = await Review.findByIdAndUpdate(reviewId, update, { new: true });

  // Hiding, removing or restoring a review changes what the provider's rating
  // is made of, so the headline rating has to follow.
  if (moderated) {
    const targetId = String(moderated.targetId);
    if (moderated.targetType === "VENUE") await recomputeVenueRating(targetId);
    else if (moderated.targetType === "Coach") await recomputeCoachRating(targetId);
  }

  return moderated;
};
