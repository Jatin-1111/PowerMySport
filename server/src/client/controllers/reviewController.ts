import { Request, Response } from "express";
import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { Coach } from "../models/Coach";
import { Review } from "../models/Review";
import { Venue } from "../models/Venue";
import { User } from "../models/User";
import { NotificationService } from "../services/NotificationService";
import {
  getFlaggedReviews,
  moderateReview as moderateReviewByAction,
} from "../services/ReviewService";
import { log as __rootLog } from "../../utils/logger";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
const log = __rootLog.child("review");

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

const isBookingReviewable = (bookingStatus: string, bookingDate: Date): boolean => {
  if (bookingStatus === "COMPLETED") return true;

  if (bookingStatus === "CANCELLED" || bookingStatus === "NO_SHOW") {
    return false;
  }

  const endOfBookingDay = new Date(bookingDate);
  endOfBookingDay.setHours(23, 59, 59, 999);

  return endOfBookingDay.getTime() < Date.now();
};

const recomputeVenueRating = async (venueId: string): Promise<void> => {
  const [stats] = await Review.aggregate([
    {
      $match: {
        targetType: "VENUE",
        targetId: new mongoose.Types.ObjectId(venueId),
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  await Venue.findByIdAndUpdate(venueId, {
    rating: stats?.averageRating || 0,
    reviewCount: stats?.reviewCount || 0,
  });
};

const recomputeCoachRating = async (coachId: string): Promise<void> => {
  const [stats] = await Review.aggregate([
    {
      $match: {
        targetType: "Coach",
        targetId: new mongoose.Types.ObjectId(coachId),
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  await Coach.findByIdAndUpdate(coachId, {
    rating: stats?.averageRating || 0,
    reviewCount: stats?.reviewCount || 0,
  });
};

export const createReview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  const { bookingId, targetType, targetId, rating, review } = req.body as {
    bookingId: string;
    targetType: ReviewTargetType;
    targetId: string;
    rating: number;
    review?: string;
  };

  const booking = await Booking.findById(bookingId).select("userId venueId coachId status date");

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  const bookingUserId = toObjectIdString(booking.userId);
  if (!bookingUserId || bookingUserId !== req.user.id) {
    throw new AppError("Forbidden", 403);
  }

  if (!isBookingReviewable(booking.status, booking.date)) {
    throw new AppError("Review can be submitted after session completion", 400);
  }

  const bookingVenueId = toObjectIdString(booking.venueId);
  const bookingCoachId = toObjectIdString(booking.coachId);

  if (targetType === "VENUE") {
    if (!bookingVenueId || bookingVenueId !== targetId) {
      throw new AppError("This booking is not linked to the selected venue", 400);
    }
  } else {
    if (!bookingCoachId || bookingCoachId !== targetId) {
      throw new AppError("This booking is not linked to the selected coach", 400);
    }
  }

  const existing = await Review.findOne({
    bookingId,
    targetType,
  }).select("_id");

  if (existing) {
    throw new AppError("You have already submitted this review", 409);
  }

  let created;
  try {
    created = await Review.create({
      bookingId,
      userId: req.user.id,
      targetType,
      targetId,
      rating,
      ...(review ? { review } : {}),
      isVerified: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in (error as unknown as { code?: number }) &&
      (error as unknown as { code?: number }).code === 11000
    ) {
      throw new AppError("You have already submitted this review", 409);
    }
    throw error;
  }

  if (targetType === "VENUE") {
    // Independent of each other — the rating recompute doesn't need the
    // venue/reviewer lookups, and vice versa.
    const [, venue, reviewer] = await Promise.all([
      recomputeVenueRating(targetId),
      Venue.findById(targetId).select("ownerId name"),
      User.findById(req.user.id).select("name"),
    ]);

    if (venue?.ownerId && reviewer) {
      NotificationService.send({
        userId: venue.ownerId.toString(),
        type: "REVIEW_POSTED",
        title: "New Review Received",
        message: `${reviewer.name} left a ${rating}-star review for ${venue.name}`,
        data: {
          reviewId: created._id.toString(),
          venueId: targetId,
          venueName: venue.name,
          reviewerId: req.user.id,
          reviewerName: reviewer.name,
          rating,
          reviewText: review || "",
        },
      }).catch((err: Error) => log.error("Failed to send review notification:", err));
    }
  } else {
    const [, coach, reviewer] = await Promise.all([
      recomputeCoachRating(targetId),
      Coach.findById(targetId).select("userId"),
      User.findById(req.user.id).select("name"),
    ]);

    if (coach?.userId && reviewer) {
      NotificationService.send({
        userId: coach.userId.toString(),
        type: "REVIEW_POSTED",
        title: "New Review Received",
        message: `${reviewer.name} left a ${rating}-star review for your coaching`,
        data: {
          reviewId: created._id.toString(),
          coachId: targetId,
        },
      }).catch((err: Error) => log.error("Failed to send review notification:", err));
    }
  }

  res.status(201).json({
    success: true,
    message: "Review submitted successfully",
    data: created,
  });
});

const listReviewsByTarget = async (
  req: Request,
  res: Response,
  targetType: ReviewTargetType
): Promise<void> => {
  const targetParam = targetType === "VENUE" ? "venueId" : "coachId";
  const targetId = (req.params as Record<string, unknown>)[targetParam] as string;

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new AppError("Invalid target ID", 400);
  }

  const targetObjectId = new mongoose.Types.ObjectId(targetId);

  const query = {
    targetType,
    targetId: targetObjectId,
    isHidden: { $ne: true },
    moderationStatus: { $ne: "REMOVED" },
  };

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate("userId", "name photoUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(query),
  ]);

  const [stats] = await Review.aggregate([
    {
      $match: { targetType, targetId: targetObjectId },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    message: "Reviews fetched successfully",
    data: {
      reviews,
      summary: {
        averageRating: stats?.averageRating || 0,
        reviewCount: stats?.reviewCount || 0,
      },
    },
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const getVenueReviews = asyncHandler(async (req: Request, res: Response): Promise<void> =>
  listReviewsByTarget(req, res, "VENUE")
);

export const getCoachReviews = asyncHandler(async (req: Request, res: Response): Promise<void> =>
  listReviewsByTarget(req, res, "Coach")
);

export const getReviewEligibility = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { targetType, targetId } = req.query as {
      targetType?: ReviewTargetType;
      targetId?: string;
    };

    if (!targetType || !targetId || !["VENUE", "Coach"].includes(targetType)) {
      throw new AppError("targetType and targetId are required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      throw new AppError("Invalid target ID", 400);
    }

    const targetObjectId = new mongoose.Types.ObjectId(targetId);

    const bookingFilter: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(req.user.id),
      status: { $nin: ["CANCELLED", "NO_SHOW"] },
    };

    if (targetType === "VENUE") {
      bookingFilter.venueId = targetObjectId;
    } else {
      bookingFilter.coachId = targetObjectId;
    }

    const bookings = await Booking.find(bookingFilter)
      .select("_id date status")
      .sort({ date: -1 })
      .lean();

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

    const reviewed = await Review.find({
      targetType,
      bookingId: { $in: bookings.map((booking) => booking._id) },
    })
      .select("bookingId")
      .lean();

    const reviewedIds = new Set(reviewed.map((item) => String(item.bookingId)));

    const eligibleBooking = bookings.find((booking) => {
      if (!isBookingReviewable(booking.status, booking.date)) {
        return false;
      }
      return !reviewedIds.has(String(booking._id));
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
        bookingId: String(eligibleBooking._id),
      },
    });
  }
);

export const getModerationQueue = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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
  }
);

export const moderateReview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const reviewId = (req.params as Record<string, unknown>).reviewId as string;
  const { action, moderationNotes } = req.body as {
    action?: "APPROVE" | "REMOVE" | "HIDE";
    moderationNotes?: string;
  };

  if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
    throw new AppError("Invalid review id", 400);
  }

  if (!action || !["APPROVE", "REMOVE", "HIDE"].includes(action)) {
    throw new AppError("action must be APPROVE, REMOVE, or HIDE", 400);
  }

  const review = await moderateReviewByAction(reviewId, action, moderationNotes);

  if (!review) {
    throw new AppError("Review not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Review moderated successfully",
    data: review,
  });
});
