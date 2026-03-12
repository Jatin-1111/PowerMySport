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

type ReviewTargetType = "VENUE" | "COACH";

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
        targetType: "COACH",
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

    const booking = await Booking.findById(bookingId).select(
      "userId venueId coachId status date",
    );

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

    const existing = await Review.findOne({
      bookingId,
      targetType,
    }).select("_id");

    if (existing) {
      res.status(409).json({
        success: false,
        message: "You have already submitted this review",
      });
      return;
    }

    const created = await Review.create({
      bookingId,
      userId: req.user.id,
      targetType,
      targetId,
      rating,
      ...(review ? { review } : {}),
      isVerified: true,
    });

    if (targetType === "VENUE") {
      await recomputeVenueRating(targetId);

      // Send notification to venue owner
      const venue = await Venue.findById(targetId).select("ownerId name");
      const reviewer = await User.findById(req.user.id).select("name");

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
        }).catch((err: Error) =>
          console.error("Failed to send review notification:", err),
        );
      }
    } else {
      await recomputeCoachRating(targetId);

      // Send notification to coach
      const coach = await Coach.findById(targetId).select("userId");
      const reviewer = await User.findById(req.user.id).select("name");

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
    if (
      error instanceof Error &&
      "code" in (error as unknown as { code?: number }) &&
      (error as unknown as { code?: number }).code === 11000
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

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      res.status(400).json({
        success: false,
        message: "Invalid target ID",
      });
      return;
    }

    const targetObjectId = new mongoose.Types.ObjectId(targetId);

    const query = {
      targetType,
      targetId: targetObjectId,
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
): Promise<void> => listReviewsByTarget(req, res, "COACH");

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

    if (!targetType || !targetId || !["VENUE", "COACH"].includes(targetType)) {
      res.status(400).json({
        success: false,
        message: "targetType and targetId are required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      res.status(400).json({
        success: false,
        message: "Invalid target ID",
      });
      return;
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

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
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
