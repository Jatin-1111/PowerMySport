import { Request, Response } from "express";
import { Booking } from "../../models/Booking";
import {
  getUserBookings,
  getCoachBookings,
  getVenueListerBookings,
  initiateBooking,
} from "../../services/BookingService";
import { getPaginationParams } from "../../../utils/pagination";
import { transformDocument } from "../../../middleware/responseTransform";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("booking");

/**
 * Initiate a new booking
 * POST /api/bookings/initiate
 */
export const initiateNewBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (user.role !== "Player" && user.role !== "Parent") {
      res.status(403).json({
        success: false,
        message: "Booking is available for player and parent accounts.",
      });
      return;
    }

    const result = await initiateBooking({
      userId: user.id,
      ...req.body,
      date: new Date(req.body.date),
    });

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: {
        booking: result.booking.toJSON(),
      },
    });
  } catch (error) {
    log.error("[initiateNewBooking] Error details:", {
      body: req.body,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to initiate booking",
    });
  }
};

/**
 * Get user's bookings
 * GET /api/bookings/my-bookings
 */
/**
 * Get user's bookings
 * GET /api/bookings/my-bookings
 */
export const getMyBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const userId = req.user.id;

    const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);

    let result;

    // Different logic based on role
    if (req.user.role === "VenueLister") {
      result = await getVenueListerBookings(req.user.id, page, limit);
    } else if (req.user.role === "Coach") {
      result = await getCoachBookings(req.user.id, page, limit);
    } else {
      // For PLAYER and others, get bookings they made
      result = await getUserBookings(req.user.id, page, limit);
    }

    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: result.bookings,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:bookingId
 */
export const getBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await Booking.findById(bookingId)
      .select("+checkInCode")
      .populate([
        { path: "userId" },
        { path: "venueId" },
        {
          path: "coachId",
          populate: { path: "userId", select: "name email phone" },
        },
        { path: "academyId" },
        { path: "participantId" },
      ]);

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    const getRefId = (value: unknown): string | null => {
      if (!value || typeof value !== "object") return null;
      const asRecord = value as Record<string, unknown>;
      const id = asRecord._id || asRecord.id;
      return id ? String(id) : null;
    };

    const isAdmin = req.user.role === "Admin";
    const bookingOwnerId = getRefId(booking.userId) || String(booking.userId);
    const isBookingOwner = bookingOwnerId === req.user.id;

    let isVenueOwner = false;
    if (booking.venueId && req.user.role === "VenueLister") {
      // venueId is already fully populated above (line ~201) — no need to
      // re-fetch it just to read ownerId off the same document.
      const venueOwnerId = (booking.venueId as any)?.ownerId;
      isVenueOwner = Boolean(venueOwnerId && venueOwnerId.toString() === req.user.id);
    }

    if (!isAdmin && !isBookingOwner && !isVenueOwner) {
      res.status(403).json({
        success: false,
        message: "Forbidden",
      });
      return;
    }

    // Transform booking to include id field
    const bookingData = transformDocument(booking.toObject());

    res.status(200).json({
      success: true,
      message: "Booking retrieved successfully",
      data: bookingData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch booking",
    });
  }
};

// Legacy endpoint for backward compatibility
export const createNewBooking = initiateNewBooking;
