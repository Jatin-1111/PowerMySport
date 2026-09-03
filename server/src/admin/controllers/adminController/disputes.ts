import { Request, Response } from "express";
import mongoose from "mongoose";
import { Dispute } from "../../../client/models/Dispute";
import { BookingEventService } from "../../../client/services/BookingEventService";
import { processBookingRefund } from "../../../client/services/BookingService";
import { NotificationService } from "../../../client/services/NotificationService";
import { isPhonePeGatewayError } from "../../../shared/services/PhonePeService";
import { sendDisputeStatusEmail } from "../../../utils/email";
import { recordAuditLog } from "../../services/AuditLogService";
import { auditContext, log } from "./shared";

/**
 * List all disputes
 * GET /api/admin/disputes
 */
export const listDisputes = async (req: Request, res: Response): Promise<void> => {
  try {
    const disputes = await Dispute.find()
      .populate({
        path: "bookingId",
        populate: { path: "venueId", select: "name" },
      })
      .populate("userId", "firstName lastName email phone")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();

    res.status(200).json({
      success: true,
      message: "Disputes retrieved successfully",
      data: disputes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch disputes",
    });
  }
};

/**
 * Full audit timeline for one booking or expert session.
 * GET /api/admin/bookings/:subjectId/timeline
 *
 * The subject id is looked up across both BOOKING and EXPERT_SESSION on
 * purpose: support staff paste an id from a URL or an email and shouldn't have
 * to know which of the two systems it belongs to. `subjectType` is returned on
 * each event so the caller can still tell them apart.
 */
export const getBookingTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = String((req.params as Record<string, unknown>).subjectId ?? "");

    if (!subjectId) {
      res.status(400).json({ success: false, message: "subjectId is required" });
      return;
    }

    const events = await BookingEventService.getTimelineByIdAcrossSubjects(subjectId);

    res.status(200).json({
      success: true,
      message: "Booking timeline retrieved successfully",
      data: events,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch booking timeline",
    });
  }
};

/**
 * Handle dispute for a booking (STUB - requires payment gateway integration)
 * POST /api/admin/disputes/:bookingId
 *
 * Future implementation:
 * - Verify dispute details
 * - Review booking history and evidence
 * - Determine resolution (refund, partial refund, no action)
 * - Process appropriate financial transactions
 * - Update booking status
 * - Notify all parties
 */
export const handleDispute = async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const { disputeType, resolution, evidence, reason } = req.body as {
      disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
      resolution: "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND";
      evidence?: string;
      reason?: string;
    };

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
      return;
    }

    if (!disputeType || !resolution) {
      res.status(400).json({
        success: false,
        message: "disputeType and resolution are required",
      });
      return;
    }

    const validDisputeTypes = ["NO_SHOW", "POOR_QUALITY", "PAYMENT_ISSUE", "OTHER"];
    const validResolutions = ["FULL_REFUND", "PARTIAL_REFUND", "NO_REFUND"];

    if (!validDisputeTypes.includes(disputeType)) {
      res.status(400).json({
        success: false,
        message: `Invalid disputeType. Must be one of: ${validDisputeTypes.join(", ")}`,
      });
      return;
    }

    if (!validResolutions.includes(resolution)) {
      res.status(400).json({
        success: false,
        message: `Invalid resolution. Must be one of: ${validResolutions.join(", ")}`,
      });
      return;
    }

    const disputeReason =
      reason?.trim() ||
      `Dispute resolved: ${disputeType.replace(/_/g, " ").toLowerCase()} — ${resolution.replace(/_/g, " ").toLowerCase()}`;

    // Determine refund percentage based on resolution
    let refundResult: {
      refundAmount: number;
      refundPercentage: number;
      refundStatus: string;
    } | null = null;

    if (resolution === "FULL_REFUND") {
      refundResult = await processBookingRefund(bookingId, 100, disputeReason);
    } else if (resolution === "PARTIAL_REFUND") {
      refundResult = await processBookingRefund(bookingId, 50, disputeReason);
    }
    // For NO_REFUND: no payment action needed, just log the decision

    // Send notification to player
    try {
      const { Booking } = await import("../../../client/models/Booking");
      const { User } = await import("../../../client/models/User");
      const booking = await Booking.findById(bookingId);
      if (booking?.userId) {
        const disputeUser = await User.findById(booking.userId).select("name email").lean();
        if (disputeUser?.email) {
          sendDisputeStatusEmail({
            name: disputeUser.name,
            email: disputeUser.email,
            disputeType,
            status: "RESOLVED",
            bookingId,
            resolution,
            refundAmount: refundResult?.refundAmount,
          }).catch((error) => log.error("Failed to send dispute email:", error));
        }

        const notifMessages: Record<string, string> = {
          FULL_REFUND: `Your dispute for booking has been resolved. A full refund of ₹${refundResult?.refundAmount ?? 0} is being processed.`,
          PARTIAL_REFUND: `Your dispute for booking has been resolved. A partial refund of ₹${refundResult?.refundAmount ?? 0} is being processed.`,
          NO_REFUND: `Your dispute for booking has been reviewed. After careful consideration, a refund could not be issued for this case. Please contact support if you have questions.`,
        };

        await NotificationService.send({
          userId: booking.userId.toString(),
          type: "PAYMENT_REFUND",
          title: "Dispute Resolved",
          message:
            notifMessages[resolution] ??
            `Your dispute for booking has been reviewed. Resolution: ${resolution.replace(/_/g, " ").toLowerCase()}.`,
          data: {
            bookingId,
            disputeType,
            resolution,
            refundAmount: refundResult?.refundAmount ?? 0,
            resolvedAt: new Date().toISOString(),
          },
        });
      }
    } catch (notifError) {
      log.error("[handleDispute] Failed to send dispute notification:", notifError);
    }

    const auditDispute = auditContext(req);
    if (auditDispute) {
      void recordAuditLog({
        ...auditDispute,
        action: "dispute.resolve",
        targetType: "Booking",
        targetId: bookingId,
        metadata: { disputeType, resolution, reason: disputeReason },
      });
    }

    res.status(200).json({
      success: true,
      message: "Dispute resolved successfully",
      data: {
        bookingId,
        disputeType,
        resolution,
        evidence: evidence || null,
        reason: disputeReason,
        refundAmount: refundResult?.refundAmount ?? 0,
        refundPercentage: refundResult?.refundPercentage ?? 0,
        refundStatus: refundResult?.refundStatus ?? "NOT_APPLICABLE",
        resolvedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 500;
    res.status(statusCode).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to handle dispute",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};
