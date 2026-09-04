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
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Initiate a new booking
 * POST /api/bookings/initiate
 */
export const initiateNewBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;
    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    if (user.role !== "Player" && user.role !== "Parent") {
      throw new AppError("Booking is available for player and parent accounts.", 403);
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
  }
);

/**
 * Get user's bookings
 * GET /api/bookings/my-bookings
 */
/**
 * Get user's bookings
 * GET /api/bookings/my-bookings
 */
export const getMyBookings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
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
});

/**
 * Get booking by ID
 * GET /api/bookings/:bookingId
 */
export const getBookingById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
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
    throw new AppError("Booking not found", 404);
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
    throw new AppError("Forbidden", 403);
  }

  // Transform booking to include id field
  const bookingData = transformDocument(booking.toObject());

  res.status(200).json({
    success: true,
    message: "Booking retrieved successfully",
    data: bookingData,
  });
});

// Legacy endpoint for backward compatibility
export const createNewBooking = initiateNewBooking;
