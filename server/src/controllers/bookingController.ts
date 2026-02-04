import { Request, Response } from "express";
import {
  initiateBooking,
  updatePaymentStatus,
  getUserBookings,
  getVenueBookings,
  getVenueListerBookings,
  cancelBooking,
  verifyBooking,
} from "../services/BookingService";
import {
  processMockPayment,
  handlePaymentWebhook,
} from "../services/PaymentService";
import { generateHourlySlots } from "../utils/booking";
import { Booking } from "../models/Booking";

/**
 * Initiate a new booking with split payments
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
      message: "Booking initiated successfully",
      data: {
        booking: result.booking,
        paymentLinks: result.paymentLinks,
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
 * Process mock payment (for testing without real payment gateway)
 * POST /api/bookings/mock-payment
 */
export const processMockPaymentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { userId, bookingId, amount } = req.body;

    if (!userId || !bookingId || !amount) {
      res.status(400).json({
        success: false,
        message: "userId, bookingId, and amount are required",
      });
      return;
    }

    const result = await processMockPayment({ userId, bookingId, amount });

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Payment processing failed",
    });
  }
};

/**
 * Payment webhook handler
 * POST /api/bookings/webhook
 */
export const paymentWebhookHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // In production, verify webhook signature here
    await handlePaymentWebhook(req.body);

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Webhook processing failed",
    });
  }
};

/**
 * Verify booking with verification token
 * GET /api/bookings/verify/:token
 */
export const verifyBookingByToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const token = (req.params as Record<string, unknown>).token as string;

    const booking = await verifyBooking(token);

    if (!booking) {
      res.status(404).json({
        success: false,
        message: "Invalid or expired verification token",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Booking verified successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Verification failed",
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

    let bookings;

    // Different logic based on role
    if (req.user.role === "VENUE_LISTER") {
      bookings = await getVenueListerBookings(req.user.id);
    } else {
      // For PLAYER and others, get bookings they made
      bookings = await getUserBookings(req.user.id);
    }

    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: bookings,
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
    const bookings = await getVenueBookings(venueId);
    const bookedSlots = bookings
      .filter(
        (b) =>
          new Date(b.date).toDateString() ===
          new Date(date as string).toDateString(),
      )
      .map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
      }));

    const allSlots = generateHourlySlots(6, 23);
    const availableSlots = allSlots.filter((slot) => {
      const slotParts = slot.split(":");
      const slotHour = parseInt(slotParts[0] || "0", 10);
      const nextHour = String(slotHour + 1).padStart(2, "0") + ":00";

      return !bookedSlots.some((booked) => {
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

// Legacy endpoint for backward compatibility
export const createNewBooking = initiateNewBooking;
