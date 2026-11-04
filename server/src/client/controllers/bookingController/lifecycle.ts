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
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Cancel a booking
 * DELETE /api/bookings/:bookingId
 */
export const cancelBookingById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const { cancellationReason } = (req.body ?? {}) as {
      cancellationReason?: string;
    };

    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new AppError("Authentication required", 401);
    }

    const result = await cancelBooking(bookingId, requesterId, cancellationReason);

    if (!result.booking) {
      throw new AppError("Booking not found", 404);
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
  }
);

/**
 * Retry a failed refund — player-initiated
 * POST /api/bookings/:bookingId/retry-refund
 */
export const retryBookingRefund = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const booking = await Booking.findOne({ _id: bookingId, userId }).lean();
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.refundStatus !== "REJECTED") {
      throw new AppError("No failed refund to retry for this booking", 400);
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
  }
);

/**
 * Confirm booking by provider (coach/venue)
 * POST /api/bookings/:bookingId/provider/confirm
 */
export const confirmBookingByProviderHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await confirmBookingByProvider(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Booking confirmed successfully",
      data: booking,
    });
  }
);

/**
 * Reject booking by provider (coach/venue)
 * POST /api/bookings/:bookingId/provider/reject
 */
export const rejectBookingByProviderHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
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
  }
);

/**
 * Check-in to booking using random check-in code
 * POST /api/bookings/check-in/code
 */
export const checkInBookingWithCode = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { checkInCode } = req.body as { checkInCode: string };

    const booking = await checkInBookingByCode(checkInCode, req.user.id, req.user.role);

    res.status(200).json({
      success: true,
      message: "Checked in successfully",
      data: booking,
    });
  }
);

/**
 * Confirm mock payment success for a booking
 * POST /api/bookings/:bookingId/mock-payment-success
 */
export const confirmMockPaymentSuccessById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    const booking = await confirmMockPaymentSuccess(bookingId, req.user.id);

    res.status(200).json({
      success: true,
      message: "Mock payment confirmed successfully",
      data: booking,
    });
  }
);

/**
 * Reschedule a confirmed booking — coach only
 * POST /api/bookings/:bookingId/reschedule
 */
export const rescheduleBookingHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { bookingId } = req.params as { bookingId: string };
    const { newDate, newStartTime, newEndTime } = req.body as {
      newDate: string;
      newStartTime: string;
      newEndTime: string;
    };

    if (!newDate || !newStartTime || !newEndTime) {
      throw new AppError("newDate, newStartTime, and newEndTime are required", 400);
    }

    const parsedDate = new Date(newDate);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError("Invalid date format", 400);
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(newStartTime) || !timeRegex.test(newEndTime)) {
      throw new AppError("Time must be in HH:mm format", 400);
    }

    if (newStartTime >= newEndTime) {
      throw new AppError("End time must be after start time", 400);
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
  }
);
