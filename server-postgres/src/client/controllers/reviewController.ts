import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { NotificationService } from "../services/NotificationService";
import {
  getFlaggedReviews,
  moderateReview as moderateReviewByAction,
} from "../services/ReviewService";

type ReviewTargetType = "VENUE" | "Coach";

const toObjectIdString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const candidate = value as {
      _id?: unknown;
      id?: unknown;
      toString?: () => string;
    };
    if (candidate._id) return String(candidate._id);
    if (candidate.id) return String(candidate.id);
    if (typeof candidate.toString === "function") return candidate.toString();
  }
  return null;
};

const isBookingReviewable = (
  bookingStatus: string,
  bookingDate: Date,
): boolean => {
  if (bookingStatus === "COMPLETED") return true;

  if (bookingStatus === "CANCELLED" || bookingStatus === "NO_SHOW") {
    return false;
  }

  const endOfBookingDay = new Date(bookingDate);
  endOfBookingDay.setHours(23, 59, 59, 999);

  return endOfBookingDay.getTime() < Date.now();
};

const recomputeVenueRating = async (venueId: string): Promise<void> => {
  const stats = await prisma.review.aggregate({
    where: { targetType: "VENUE", targetId: venueId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  // updateMany (not update) preserves the original findByIdAndUpdate behaviour
  // of silently no-op'ing when the venue is missing (no thrown error).
  await prisma.venue.updateMany({
    where: { id: venueId },
    data: {
      rating: stats._avg.rating || 0,
      reviewCount: stats._count._all || 0,
    },
  });
};

const recomputeCoachRating = async (coachId: string): Promise<void> => {
  const stats = await prisma.review.aggregate({
    where: { targetType: "Coach", targetId: coachId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.coach.updateMany({
    where: { id: coachId },
    data: {
      rating: stats._avg.rating || 0,
      reviewCount: stats._count._all || 0,
    },
  });
};

export const createReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { bookingId, targetType, targetId, rating, review } = req.body as {
      bookingId: string;
      targetType: ReviewTargetType;
      targetId: string;
      rating: number;
      review?: string;
    };

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        userId: true,
        venueId: true,
        coachId: true,
        status: true,
        date: true,
      },
    });

    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    const bookingUserId = toObjectIdString(booking.userId);
    if (!bookingUserId || bookingUserId !== req.user.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    if (!isBookingReviewable(booking.status, booking.date)) {
      res.status(400).json({
        success: false,
        message: "Review can be submitted after session completion",
      });
      return;
    }

    const bookingVenueId = toObjectIdString(booking.venueId);
    const bookingCoachId = toObjectIdString(booking.coachId);

    if (targetType === "VENUE") {
      if (!bookingVenueId || bookingVenueId !== targetId) {
        res.status(400).json({
          success: false,
          message: "This booking is not linked to the selected venue",
        });
        return;
      }
    } else {
      if (!bookingCoachId || bookingCoachId !== targetId) {
        res.status(400).json({
          success: false,
          message: "This booking is not linked to the selected coach",
        });
        return;
      }
    }

    const existing = await prisma.review.findFirst({
      where: { bookingId, targetType },
      select: { id: true },
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: "You have already submitted this review",
      });
      return;
    }

    const created = await prisma.review.create({
      data: {
        bookingId,
        userId: req.user.id,
        targetType,
        targetId,
        rating,
        ...(review ? { review } : {}),
        isVerified: true,
      },
    });

    if (targetType === "VENUE") {
      await recomputeVenueRating(targetId);

      // Send notification to venue owner
      const venue = await prisma.venue.findUnique({
        where: { id: targetId },
        select: { ownerId: true, name: true },
      });
      const reviewer = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true },
      });

      if (venue?.ownerId && reviewer) {
        NotificationService.send({
          userId: venue.ownerId.toString(),
          type: "REVIEW_POSTED",
          title: "New Review Received",
          message: `${reviewer.name} left a ${rating}-star review for ${venue.name}`,
          data: {
            reviewId: created.id.toString(),
            venueId: targetId,
            venueName: venue.name,
            reviewerId: req.user.id,
            reviewerName: reviewer.name,
            rating,
            reviewText: review || "",
          },
        }).catch((err: Error) =>
          console.error("Failed to send review notification:", err),
        );
      }
    } else {
      await recomputeCoachRating(targetId);

      // Send notification to coach
      const coach = await prisma.coach.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      const reviewer = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true },
      });

      if (coach?.userId && reviewer) {
        NotificationService.send({
          userId: coach.userId.toString(),
          type: "REVIEW_POSTED",
          title: "New Review Received",
          message: `${reviewer.name} left a ${rating}-star review for your coaching`,
          data: {
            reviewId: created.id.toString(),
            coachId: targetId,
          },
        }).catch((err: Error) =>
          console.error("Failed to send review notification:", err),
        );
      }
    }

    res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: created,
    });
  } catch (error) {
    // Legacy Mongo duplicate-key (11000). If a unique constraint is added on
    // (bookingId, targetType) in Postgres, Prisma surfaces this as P2002.
    const code = (error as unknown as { code?: number | string }).code;
    if (
      error instanceof Error &&
      "code" in (error as unknown as { code?: number | string }) &&
      (code === 11000 || code === "P2002")
    ) {
      res.status(409).json({
        success: false,
        message: "You have already submitted this review",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to submit review",
    });
  }
};

const listReviewsByTarget = async (
  req: Request,
  res: Response,
  targetType: ReviewTargetType,
): Promise<void> => {
  try {
    const targetParam = targetType === "VENUE" ? "venueId" : "coachId";
    const targetId = (req.params as Record<string, unknown>)[
      targetParam
    ] as string;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // TODO(prisma): ids are now cuids, not Mongo ObjectIds — validate as a
    // non-empty string instead of ObjectId.isValid.
    if (!targetId || typeof targetId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid target ID",
      });
      return;
    }

    const query = {
      targetType,
      targetId,
      isHidden: false,
      moderationStatus: { not: "REMOVED" as const },
    };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: query,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: query }),
    ]);

    // .populate("userId", "name photoUrl") → follow-up fetch joined under the
    // original `userId` key. TODO(prisma): populated object now exposes `id`
    // (was `_id`).
    const userIds = [...new Set(reviews.map((r) => r.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, photoUrl: true },
    });
    const usersById = new Map(users.map((u) => [u.id, u]));
    const populatedReviews = reviews.map((r) => ({
      ...r,
      userId: usersById.get(r.userId) ?? null,
    }));

    const stats = await prisma.review.aggregate({
      where: { targetType, targetId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: {
        reviews: populatedReviews,
        summary: {
          averageRating: stats._avg.rating || 0,
          reviewCount: stats._count._all || 0,
        },
      },
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch reviews",
    });
  }
};

export const getVenueReviews = async (
  req: Request,
  res: Response,
): Promise<void> => listReviewsByTarget(req, res, "VENUE");

export const getCoachReviews = async (
  req: Request,
  res: Response,
): Promise<void> => listReviewsByTarget(req, res, "Coach");

export const getReviewEligibility = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { targetType, targetId } = req.query as {
      targetType?: ReviewTargetType;
      targetId?: string;
    };

    if (!targetType || !targetId || !["VENUE", "Coach"].includes(targetType)) {
      res.status(400).json({
        success: false,
        message: "targetType and targetId are required",
      });
      return;
    }

    // TODO(prisma): ids are now cuids — validate as a non-empty string.
    if (typeof targetId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid target ID",
      });
      return;
    }

    const bookingFilter: Prisma.BookingWhereInput = {
      userId: req.user.id,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      ...(targetType === "VENUE"
        ? { venueId: targetId }
        : { coachId: targetId }),
    };

    const bookings = await prisma.booking.findMany({
      where: bookingFilter,
      select: { id: true, date: true, status: true },
      orderBy: { date: "desc" },
    });

    if (!bookings.length) {
      res.status(200).json({
        success: true,
        message: "Eligibility checked",
        data: {
          eligible: false,
          bookingId: null,
          reason: "No bookings found for this listing",
        },
      });
      return;
    }

    const reviewed = await prisma.review.findMany({
      where: {
        targetType,
        bookingId: { in: bookings.map((booking) => booking.id) },
      },
      select: { bookingId: true },
    });

    const reviewedIds = new Set(reviewed.map((item) => String(item.bookingId)));

    const eligibleBooking = bookings.find((booking) => {
      if (!isBookingReviewable(booking.status, booking.date)) {
        return false;
      }
      return !reviewedIds.has(String(booking.id));
    });

    if (!eligibleBooking) {
      res.status(200).json({
        success: true,
        message: "Eligibility checked",
        data: {
          eligible: false,
          bookingId: null,
          reason: "No reviewable booking available yet",
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Eligibility checked",
      data: {
        eligible: true,
        bookingId: String(eligibleBooking.id),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to check eligibility",
    });
  }
};

export const getModerationQueue = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const result = await getFlaggedReviews(page, limit);

    res.status(200).json({
      success: true,
      message: "Moderation queue retrieved successfully",
      data: result.reviews,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve moderation queue",
    });
  }
};

export const moderateReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const reviewId = (req.params as Record<string, unknown>).reviewId as string;
    const { action, moderationNotes } = req.body as {
      action?: "APPROVE" | "REMOVE" | "HIDE";
      moderationNotes?: string;
    };

    // TODO(prisma): ids are now cuids — validate as a non-empty string.
    if (!reviewId || typeof reviewId !== "string") {
      res.status(400).json({ success: false, message: "Invalid review id" });
      return;
    }

    if (!action || !["APPROVE", "REMOVE", "HIDE"].includes(action)) {
      res.status(400).json({
        success: false,
        message: "action must be APPROVE, REMOVE, or HIDE",
      });
      return;
    }

    const review = await moderateReviewByAction(
      reviewId,
      action,
      moderationNotes,
    );

    if (!review) {
      res.status(404).json({ success: false, message: "Review not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Review moderated successfully",
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to moderate review",
    });
  }
};
