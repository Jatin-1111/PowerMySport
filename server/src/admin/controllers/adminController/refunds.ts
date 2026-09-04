import { Request, Response } from "express";
import {
  getBookingPhonePeRefundStatus,
  processBookingRefund,
} from "../../../client/services/BookingService";
import { isPhonePeGatewayError } from "../../../shared/services/PhonePeService";
import { recordAuditLog } from "../../services/AuditLogService";
import { auditContext } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Process refund for a booking
 * POST /api/admin/refunds/:bookingId
 *
 * NOTE: keeps its own try/catch. The catch classifies PhonePe gateway errors
 * (via isPhonePeGatewayError) to surface their specific statusCode plus a
 * machine-readable code/retryable payload the client depends on — not a
 * generic log-and-respond, so it is preserved rather than deleted.
 */
export const processRefund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const {
      refundType,
      reason,
      refundPercentage: customPercentage,
    } = req.body as {
      refundType: "FULL" | "PARTIAL";
      reason: string;
      refundPercentage?: number;
    };

    if (!refundType || !reason?.trim()) {
      throw new AppError("refundType and reason are required", 400);
    }

    let refundPercentage: number;
    if (refundType === "FULL") {
      refundPercentage = 100;
    } else if (
      typeof customPercentage === "number" &&
      customPercentage > 0 &&
      customPercentage < 100
    ) {
      refundPercentage = customPercentage;
    } else {
      refundPercentage = 50;
    }
    const result = await processBookingRefund(bookingId, refundPercentage, reason.trim());

    const auditRefund = auditContext(req);
    if (auditRefund) {
      void recordAuditLog({
        ...auditRefund,
        action: "booking.refund",
        targetType: "Booking",
        targetId: bookingId,
        metadata: { refundType, reason: reason.trim(), refundPercentage },
      });
    }

    res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      data: {
        bookingId,
        refundAmount: result.refundAmount,
        refundPercentage: result.refundPercentage,
        refundStatus: result.refundStatus,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 500;

    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to process refund",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
});

/**
 * List bookings with refunds
 * GET /api/admin/refunds?refundStatus=PENDING&page=1&limit=20
 */
export const listRefunds = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { Booking } = await import("../../../client/models/Booking");
  const refundStatus = req.query.refundStatus as string;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const query: any = {
    refundStatus: { $exists: true, $ne: null },
  };

  if (refundStatus) {
    query.refundStatus = refundStatus;
  }

  const [bookings, total, statsResult] = await Promise.all([
    Booking.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email phone")
      .populate("venueId", "name")
      .lean(),
    Booking.countDocuments(query),
    Booking.aggregate([
      { $match: { refundStatus: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$refundStatus",
          count: { $sum: 1 },
          amount: { $sum: "$refundAmount" },
        },
      },
    ]),
  ]);

  const stats = {
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0,
    totalAmount: 0,
  };

  statsResult.forEach((s) => {
    if (s._id === "PENDING") stats.pendingCount = s.count;
    else if (s._id === "PROCESSED") stats.completedCount = s.count;
    else if (s._id === "REJECTED") stats.failedCount = s.count;

    // Sum the amounts (in rupees)
    stats.totalAmount += s.amount || 0;
  });

  const formattedRefunds = bookings.map((booking: any) => ({
    id: booking._id.toString(),
    bookingId: booking._id.toString(),
    playerId: booking.userId?._id?.toString() || "",
    playerName: booking.userId?.name || "Unknown",
    playerEmail: booking.userId?.email || "",
    amount: booking.refundAmount || 0,
    originalPaymentMethod: "ONLINE",
    status:
      booking.refundStatus === "PROCESSED"
        ? "COMPLETED"
        : booking.refundStatus === "REJECTED"
          ? "FAILED"
          : "PENDING",
    requestedAt: booking.updatedAt || booking.createdAt,
  }));

  res.status(200).json({
    success: true,
    message: "Refund bookings retrieved successfully",
    data: formattedRefunds,
    stats,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * Get PhonePe refund status for a booking
 * GET /api/admin/refunds/:bookingId/status
 *
 * NOTE: same rationale as processRefund above — the catch classifies PhonePe
 * gateway errors to preserve their statusCode/code/retryable payload, so it
 * is kept rather than collapsed into a thrown AppError.
 */
export const getRefundStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;

    if (!bookingId) {
      throw new AppError("bookingId is required", 400);
    }

    const status = await getBookingPhonePeRefundStatus(bookingId);

    res.status(200).json({
      success: true,
      message: "Refund status retrieved successfully",
      data: status,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 500;

    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch refund status",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
});
