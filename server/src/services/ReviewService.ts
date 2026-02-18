import { Booking } from "../models/Booking";
import { Coach } from "../models/Coach";
import { Review, ReviewDocument } from "../models/Review";
import { Venue } from "../models/Venue";

export interface CreateReviewPayload {
  bookingId: string;
  userId: string;
  venueRating: number;
  coachRating?: number;
  venueReview?: string;
  coachReview?: string;
}

/**
 * Create a review for a completed booking
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

  // Check if review already exists
  const existingReview = await Review.findOne({ bookingId: payload.bookingId });
  if (existingReview) {
    throw new Error("Review already exists for this booking");
  }

  // Validate coach rating if coach was part of booking
  if (booking.coachId && !payload.coachRating) {
    throw new Error("Coach rating is required when coach was booked");
  }

  // Create review
  const review = new Review({
    bookingId: payload.bookingId,
    userId: payload.userId,
    venueId: booking.venueId,
    coachId: booking.coachId,
    venueRating: payload.venueRating,
    coachRating: payload.coachRating,
    venueReview: payload.venueReview,
    coachReview: payload.coachReview,
    isVerified: true, // From completed booking
  });

  await review.save();

  // Update venue rating
  await updateVenueRating(booking.venueId.toString());

  // Update coach rating if coach was involved
  if (booking.coachId) {
    await updateCoachRating(booking.coachId.toString());
  }

  return review;
};

/**
 * Update venue's average rating and review count
 */
const updateVenueRating = async (venueId: string): Promise<void> => {
  const stats = await Review.aggregate([
    { $match: { venueId: venueId as any } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$venueRating" },
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
  // Validate coachId
  if (!coachId) {
    return;
  }

  const stats = await Review.aggregate([
    { $match: { coachId: coachId as any, coachRating: { $exists: true } } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$coachRating" },
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

  const total = await Review.countDocuments({ venueId });
  const reviews = await Review.find({ venueId })
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

  const total = await Review.countDocuments({
    coachId,
    coachRating: { $exists: true },
  });
  const reviews = await Review.find({ coachId, coachRating: { $exists: true } })
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
 * Report a review (for moderation)
 */
export const reportReview = async (
  reviewId: string,
): Promise<ReviewDocument | null> => {
  return Review.findByIdAndUpdate(
    reviewId,
    { $inc: { reportCount: 1 } },
    { new: true },
  );
};
