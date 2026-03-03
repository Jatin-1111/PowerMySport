import { Booking } from "../models/Booking";
import { Coach } from "../models/Coach";
import { Review, ReviewDocument } from "../models/Review";
import { Venue } from "../models/Venue";

export interface CreateReviewPayload {
  bookingId: string;
  userId: string;
  targetType: "VENUE" | "COACH";
  rating: number;
  review?: string;
}

/**
 * Create a review for a completed booking
 * Allows separate reviews for venue and coach
 * Only allows reviews for COMPLETED bookings
 * Updates venue and coach average ratings
 */
export const createReview = async (
  payload: CreateReviewPayload,
): Promise<ReviewDocument> => {
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
  } else if (payload.targetType === "COACH") {
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
    throw new Error(
      `You have already reviewed this ${payload.targetType.toLowerCase()}`,
    );
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
    await updateVenueRating(targetId.toString());
  } else if (payload.targetType === "COACH") {
    await updateCoachRating(targetId.toString());
  }

  return review;
};

/**
 * Update venue's average rating and review count
 */
const updateVenueRating = async (venueId: string): Promise<void> => {
  const stats = await Review.aggregate([
    { $match: { targetType: "VENUE", targetId: venueId as any } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Venue.findByIdAndUpdate(venueId, {
      rating: Math.round(stats[0].avgRating * 10) / 10, // Round to 1 decimal
      reviewCount: stats[0].count,
    });
  }
};

/**
 * Update coach's average rating and review count
 */
const updateCoachRating = async (coachId: string): Promise<void> => {
  if (!coachId) {
    return;
  }

  const stats = await Review.aggregate([
    { $match: { targetType: "COACH", targetId: coachId as any } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Coach.findByIdAndUpdate(coachId, {
      rating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].count,
    });
  }
};

/**
 * Get reviews for a venue
 */
export const getVenueReviews = async (
  venueId: string,
  page: number = 1,
  limit: number = 10,
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
  limit: number = 10,
): Promise<{
  reviews: ReviewDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const query = {
    targetType: "COACH" as const,
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
export const markReviewHelpful = async (
  reviewId: string,
): Promise<ReviewDocument | null> => {
  return Review.findByIdAndUpdate(
    reviewId,
    { $inc: { helpfulCount: 1 } },
    { new: true },
  );
};

/**
 * Report a review with reason (for moderation)
 */
export const reportReview = async (
  reviewId: string,
  userId: string,
  reason: string,
): Promise<ReviewDocument | null> => {
  const review = await Review.findById(reviewId);

  if (!review) {
    throw new Error("Review not found");
  }

  // Check if user already reported this review
  const alreadyReported = review.reports?.some(
    (report) => report.userId.toString() === userId,
  );

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
        moderationStatus:
          review.reportCount + 1 >= 3 ? "FLAGGED" : review.moderationStatus,
      },
    },
    { new: true },
  );

  return updatedReview;
};

/**
 * Get flagged reviews for moderation (admin only)
 */
export const getFlaggedReviews = async (
  page: number = 1,
  limit: number = 20,
): Promise<{
  reviews: ReviewDocument[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const total = await Review.countDocuments({
    moderationStatus: { $in: ["FLAGGED", "PENDING"] },
  });

  const reviews = await Review.find({
    moderationStatus: { $in: ["FLAGGED", "PENDING"] },
  })
    .populate("userId", "name email")
    .populate("targetId", "name")
    .sort({ reportCount: -1, createdAt: -1 })
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
 * Moderate a review (admin only)
 */
export const moderateReview = async (
  reviewId: string,
  action: "APPROVE" | "REMOVE" | "HIDE",
  moderationNotes?: string,
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

  return Review.findByIdAndUpdate(reviewId, update, { new: true });
};
