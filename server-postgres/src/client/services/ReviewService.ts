import prisma from "../../lib/prisma";
import type { Review, ReviewReport } from "@prisma/client";
import { sendReviewReceivedEmail } from "../../utils/email";

export interface CreateReviewPayload {
  bookingId: string;
  userId: string;
  targetType: "VENUE" | "Coach";
  rating: number;
  review?: string;
}

// The Mongo `.populate('userId', ...)` returned the user object in place of the
// ref. There is no relation for this String-FK ref, so we attach the joined
// user under a `user` key instead.
type ReviewWithUser = Review & {
  user: { id: string; name: string; email: string } | null;
};

/**
 * Create a review for a completed booking
 * Allows separate reviews for venue and coach
 * Only allows reviews for COMPLETED bookings
 * Updates venue and coach average ratings
 */
export const createReview = async (
  payload: CreateReviewPayload,
): Promise<Review> => {
  // Verify booking exists and is completed
  const booking = await prisma.booking.findUnique({
    where: { id: payload.bookingId },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "COMPLETED") {
    throw new Error("Can only review completed bookings");
  }

  if (booking.userId !== payload.userId) {
    throw new Error("You can only review your own bookings");
  }

  // Determine target ID based on target type
  let targetId: string;
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
  const existingReview = await prisma.review.findFirst({
    where: {
      bookingId: payload.bookingId,
      targetType: payload.targetType,
      userId: payload.userId,
    },
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
  const review = await prisma.review.create({
    data: {
      bookingId: payload.bookingId,
      userId: payload.userId,
      targetType: payload.targetType,
      targetId,
      rating: payload.rating,
      review: payload.review,
      isVerified: true, // From completed booking
    },
  });

  // Update venue or coach rating
  if (payload.targetType === "VENUE") {
    await updateVenueRating(targetId);
  } else if (payload.targetType === "Coach") {
    await updateCoachRating(targetId);
  }

  // Notify the provider of the new review (fire-and-forget).
  void (async () => {
    try {
      const reviewer = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { name: true },
      });
      let providerEmail: string | undefined;
      let providerName: string | undefined;
      if (payload.targetType === "VENUE") {
        const venue = await prisma.venue.findUnique({
          where: { id: targetId },
          select: { ownerId: true },
        });
        const owner = venue?.ownerId
          ? await prisma.user.findUnique({
              where: { id: venue.ownerId },
              select: { name: true, email: true },
            })
          : null;
        providerEmail = owner?.email;
        providerName = owner?.name;
      } else {
        const coach = await prisma.coach.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });
        const coachUser = coach?.userId
          ? await prisma.user.findUnique({
              where: { id: coach.userId },
              select: { name: true, email: true },
            })
          : null;
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
      console.error("Failed to send review email:", emailError);
    }
  })();

  return review;
};

/**
 * Update venue's average rating and review count
 */
const updateVenueRating = async (venueId: string): Promise<void> => {
  const stats = await prisma.review.aggregate({
    where: { targetType: "VENUE", targetId: venueId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  if (stats._count._all > 0 && stats._avg.rating != null) {
    await prisma.venue.update({
      where: { id: venueId },
      data: {
        rating: Math.round(stats._avg.rating * 10) / 10, // Round to 1 decimal
        reviewCount: stats._count._all,
      },
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

  const stats = await prisma.review.aggregate({
    where: { targetType: "Coach", targetId: coachId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  if (stats._count._all > 0 && stats._avg.rating != null) {
    await prisma.coach.update({
      where: { id: coachId },
      data: {
        rating: Math.round(stats._avg.rating * 10) / 10,
        reviewCount: stats._count._all,
      },
    });
  }
};

/**
 * Attach the reviewing user (String-FK "populate" done in code).
 */
const attachReviewUsers = async (
  reviews: Review[],
): Promise<ReviewWithUser[]> => {
  const userIds = [...new Set(reviews.map((r) => r.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return reviews.map((r) => ({ ...r, user: byId.get(r.userId) ?? null }));
};

/**
 * Get reviews for a venue
 */
export const getVenueReviews = async (
  venueId: string,
  page: number = 1,
  limit: number = 10,
): Promise<{
  reviews: ReviewWithUser[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const where = {
    targetType: "VENUE" as const,
    targetId: venueId,
    isHidden: false,
    moderationStatus: { not: "REMOVED" as const },
  };

  const total = await prisma.review.count({ where });
  const rows = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });
  const reviews = await attachReviewUsers(rows);

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
  reviews: ReviewWithUser[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const where = {
    targetType: "Coach" as const,
    targetId: coachId,
    isHidden: false,
    moderationStatus: { not: "REMOVED" as const },
  };

  const total = await prisma.review.count({ where });
  const rows = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
  });
  const reviews = await attachReviewUsers(rows);

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
): Promise<Review | null> => {
  // Preserve findByIdAndUpdate's null-on-not-found (prisma.update throws).
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) {
    return null;
  }
  return prisma.review.update({
    where: { id: reviewId },
    data: { helpfulCount: { increment: 1 } },
  });
};

/**
 * Report a review with reason (for moderation)
 */
export const reportReview = async (
  reviewId: string,
  userId: string,
  reason: string,
): Promise<(Review & { reports: ReviewReport[] }) | null> => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { reports: true },
  });

  if (!review) {
    throw new Error("Review not found");
  }

  // Check if user already reported this review
  const alreadyReported = review.reports?.some(
    (report) => report.userId === userId,
  );

  if (alreadyReported) {
    throw new Error("You have already reported this review");
  }

  // Add report and increment count (auto-flag if 3+ reports)
  const updatedReview = await prisma.$transaction(async (tx) => {
    await tx.reviewReport.create({
      data: {
        reviewId,
        userId,
        reason,
        reportedAt: new Date(),
      },
    });

    return tx.review.update({
      where: { id: reviewId },
      data: {
        reportCount: { increment: 1 },
        moderationStatus:
          review.reportCount + 1 >= 3 ? "FLAGGED" : review.moderationStatus,
      },
      include: { reports: true },
    });
  });

  return updatedReview;
};

/**
 * Get flagged reviews for moderation (admin only)
 */
export const getFlaggedReviews = async (
  page: number = 1,
  limit: number = 20,
): Promise<{
  reviews: ReviewWithUser[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  const skip = (page - 1) * limit;

  const where = {
    moderationStatus: { in: ["FLAGGED" as const, "PENDING" as const] },
  };

  const total = await prisma.review.count({ where });

  const rows = await prisma.review.findMany({
    where,
    orderBy: [{ reportCount: "desc" }, { createdAt: "desc" }],
    skip,
    take: limit,
  });
  // TODO(prisma): the Mongo version also populated `targetId` with `name`, but
  // targetId is polymorphic (Venue | Coach | Product) with no relation, so the
  // target name is not resolved here. Attach it in the admin controller if the
  // moderation UI needs it.
  const reviews = await attachReviewUsers(rows);

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
): Promise<Review | null> => {
  const update: {
    moderationNotes?: string;
    moderationStatus?: "APPROVED" | "REMOVED";
    isHidden?: boolean;
  } = {
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

  // Preserve findByIdAndUpdate's null-on-not-found (prisma.update throws).
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) {
    return null;
  }
  return prisma.review.update({ where: { id: reviewId }, data: update });
};
