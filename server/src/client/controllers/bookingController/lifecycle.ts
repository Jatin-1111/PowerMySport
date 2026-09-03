import { Request, Response } from "express";
import { Booking } from "../../models/Booking";
import {
  cancelBooking,
  checkInBookingByCode,
  confirmMockPaymentSuccess,
  confirmBookingByProvider,
  rejectBookingByProvider,
  rescheduleBookingByCoach,
  processBookingRefund,
} from "../../services/BookingService";
import { transformDocument } from "../../../middleware/responseTransform";

/**
 * Cancel a booking
 * DELETE /api/bookings/:bookingId
 */
export const cancelBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const { cancellationReason } = (req.body ?? {}) as {
      cancellationReason?: string;
    };

    const requesterId = req.user?.id;
    if (!requesterId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const result = await cancelBooking(bookingId, requesterId, cancellationReason);

    if (!result.booking) {
      res.status(404).json({
        success: false,
        message: "Booking not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Booking cancelled successfully. ${result.refundPercentage}% refund (₹${result.refundAmount}) will be processed.`,
      data: {
        booking: result.booking,
        refundAmount: result.refundAmount,
        refundPercentage: result.refundPercentage,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to cancel booking",
    });
  }
};

/**
 * Retry a failed refund — player-initiated
 * POST /api/bookings/:bookingId/retry-refund
 */
export const retryBookingRefund = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const booking = await Booking.findOne({ _id: bookingId, userId }).lean();
    if (!booking) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    if (booking.refundStatus !== "REJECTED") {
      res.status(400).json({
        success: false,
        message: "No failed refund to retry for this booking",
      });
      return;
    }

    // Compute refund percentage from the stored refundAmount; fall back to 100%.
    const totalAmount = (booking as any).totalAmount || 0;
    const storedRefund = (booking as any).refundAmount || 0;
    const refundPercentage =
      storedRefund > 0 && totalAmount > 0
        ? Math.min(100, Math.round((storedRefund / totalAmount) * 100))
        : 100;

    const result = await processBookingRefund(
      bookingId,
      refundPercentage,
      "Player-initiated refund retry"
    );

    res.status(200).json({
      success: true,
      message: "Refund retry initiated successfully.",
      data: {
        refundStatus: result.refundStatus,
        refundAmount: result.refundAmount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retry refund",
    });
  }
};

/**
 * Confirm booking by provider (coach/venue)
 * POST /api/bookings/:bookingId/provider/confirm
 */
export const confirmBookingByProviderHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await confirmBookingByProvider(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to confirm booking",
    });
  }
};

/**
 * Reject booking by provider (coach/venue)
 * POST /api/bookings/:bookingId/provider/reject
 */
export const rejectBookingByProviderHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const { reason } = (req.body ?? {}) as { reason?: string };

    const result = await rejectBookingByProvider(bookingId, req.user.id, reason);

    res.status(200).json({
      success: true,
      message: "Booking rejected successfully",
      data: {
        booking: result.booking,
        refundAmount: result.refundAmount,
        refundStatus: result.refundStatus,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reject booking",
    });
  }
};

/**
 * Check-in to booking using random check-in code
 * POST /api/bookings/check-in/code
 */
export const checkInBookingWithCode = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { checkInCode } = req.body as { checkInCode: string };

    const booking = await checkInBookingByCode(checkInCode, req.user.id, req.user.role);

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
export const confirmMockPaymentSuccessById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await confirmMockPaymentSuccess(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Mock payment confirmed successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to confirm mock payment",
    });
  }
};

/**
 * Reschedule a confirmed booking — coach only
 * POST /api/bookings/:bookingId/reschedule
 */
export const rescheduleBookingHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { bookingId } = req.params as { bookingId: string };
    const { newDate, newStartTime, newEndTime } = req.body as {
      newDate: string;
      newStartTime: string;
      newEndTime: string;
    };

    if (!newDate || !newStartTime || !newEndTime) {
      res.status(400).json({
        success: false,
        message: "newDate, newStartTime, and newEndTime are required",
      });
      return;
    }

    const parsedDate = new Date(newDate);
    if (isNaN(parsedDate.getTime())) {
      res.status(400).json({ success: false, message: "Invalid date format" });
      return;
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
      res.status(400).json({
        success: false,
        message: "Time must be in HH:mm format",
      });
      return;
    }

    if (newStartTime >= newEndTime) {
      res.status(400).json({
        success: false,
        message: "End time must be after start time",
      });
      return;
    }

    const booking = await rescheduleBookingByCoach(
      bookingId,
      req.user.id,
      parsedDate,
      newStartTime,
      newEndTime
    );

    res.status(200).json({
      success: true,
      message: "Booking rescheduled successfully",
      data: transformDocument(booking.toJSON()),
    });
  } catch (error) {
    const status =
      error instanceof Error &&
      (error.message.includes("Not authorized") || error.message.includes("not found"))
        ? 403
        : 400;
    res.status(status).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to reschedule booking",
    });
  }
};
