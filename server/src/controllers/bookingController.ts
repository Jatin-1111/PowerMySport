import { Request, Response } from "express";
import {
  cancelBooking,
  checkInBookingByCode,
  confirmMockPaymentSuccess,
  completeBooking,
  getUserBookings,
  getVenueBookingsForDate,
  getVenueListerBookings,
  initiateBooking,
  markNoShow,
} from "../services/BookingService";
import { generateHourlySlots } from "../utils/booking";

/**
 * Initiate a new booking
 * POST /api/bookings/initiate
 */
export const initiateNewBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const result = await initiateBooking({
      userId: req.user.id,
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
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to initiate booking",
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
export const getMyBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);

    let result;

    // Different logic based on role
    if (req.user.role === "VENUE_LISTER") {
      result = await getVenueListerBookings(req.user.id, page, limit);
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
      message:
        error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};

/**
 * Get venue availability
 * GET /api/bookings/availability/:venueId
 */
export const getVenueAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { date } = req.query;

    if (!date) {
      res.status(400).json({
        success: false,
        message: "Date parameter is required",
      });
      return;
    }

    // Get all bookings for this venue on the specified date
    const bookedSlots = await getVenueBookingsForDate(
      venueId,
      new Date(date as string),
    );

    // Map to simple {startTime, endTime} objects if not already (select already does partial)
    // But result is Mongoose documents, safest to map explicitly just in case
    const bookedTimeSlots = bookedSlots.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
    }));

    const allSlots = generateHourlySlots(6, 23);
    const targetDate = new Date(date as string);
    const now = new Date();
    const isToday =
      targetDate.getFullYear() === now.getFullYear() &&
      targetDate.getMonth() === now.getMonth() &&
      targetDate.getDate() === now.getDate();

    const availableSlots = allSlots.filter((slot) => {
      const slotParts = slot.split(":");
      const slotHour = parseInt(slotParts[0] || "0", 10);
      const nextHour = String(slotHour + 1).padStart(2, "0") + ":00";

      if (isToday) {
        const slotStart = new Date(targetDate);
        const slotMinute = parseInt(slotParts[1] || "0", 10);
        slotStart.setHours(slotHour, slotMinute, 0, 0);

        if (slotStart <= now) {
          return false;
        }
      }

      return !bookedTimeSlots.some((booked) => {
        return (
          (slot >= booked.startTime && slot < booked.endTime) ||
          (nextHour > booked.startTime && nextHour <= booked.endTime)
        );
      });
    });

    res.status(200).json({
      success: true,
      message: "Availability retrieved successfully",
      data: {
        availableSlots,
        bookedSlots,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch availability",
    });
  }
};

/**
 * Cancel a booking
 * DELETE /api/bookings/:bookingId
 */
export const cancelBookingById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    const booking = await cancelBooking(bookingId);

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to cancel booking",
    });
  }
};

/**
 * Check-in to booking using random check-in code
 * POST /api/bookings/check-in/code
 */
export const checkInBookingWithCode = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { checkInCode } = req.body as { checkInCode: string };

    const booking = await checkInBookingByCode(
      checkInCode,
      req.user.id,
      req.user.role,
    );

    res.status(200).json({
      success: true,
      message: "Checked in successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Check-in failed",
    });
  }
};

/**
 * Confirm mock payment success for a booking
 * POST /api/bookings/:bookingId/mock-payment-success
 */
export const confirmMockPaymentSuccessById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    const booking = await confirmMockPaymentSuccess(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Mock payment confirmed successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to confirm mock payment",
    });
  }
};

/**
 * Mark booking as completed
 * POST /api/bookings/:bookingId/complete
 */
export const completeBookingById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    // TODO: Verify that user is venue owner or admin
    const booking = await completeBooking(bookingId);

    res.status(200).json({
      success: true,
      message: "Booking marked as completed",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to complete booking",
    });
  }
};

/**
 * Mark booking as no-show
 * POST /api/bookings/:bookingId/no-show
 */
export const markBookingNoShow = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    // TODO: Verify that user is venue owner or admin
    const booking = await markNoShow(bookingId);

    res.status(200).json({
      success: true,
      message: "Booking marked as no-show",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to mark as no-show",
    });
  }
};

// Legacy endpoint for backward compatibility
export const createNewBooking = initiateNewBooking;
