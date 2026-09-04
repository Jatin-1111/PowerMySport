import { Request, Response } from "express";
import {
  initiateGroupBooking,
  respondToBookingInvitation,
  coverUnpaidShares,
  getUserBookingInvitations,
  countUserBookingInvitations,
} from "../../services/BookingService";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

// ============================================
// GROUP BOOKING ENDPOINTS
// ============================================

/**
 * Initiate a group booking with friends
 * POST /api/bookings/initiate-group
 */
export const initiateNewGroupBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    if (req.user.role !== "Player" && req.user.role !== "Parent") {
      throw new AppError("Group booking is available for player and parent accounts.", 403);
    }

    const result = await initiateGroupBooking({
      userId: req.user.id,
      ...req.body,
      date: new Date(req.body.date),
    });

    res.status(201).json({
      success: true,
      message: "Group booking created successfully",
      data: {
        booking: result.booking.toJSON(),
      },
    });
  }
);

/**
 * Respond to a booking invitation
 * POST /api/bookings/invitations/:invitationId/respond
 */
export const respondToInvitation = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { invitationId } = req.params;
    const { accept } = req.body;

    if (!invitationId || typeof invitationId !== "string") {
      throw new AppError("Invalid invitation ID", 400);
    }

    if (typeof accept !== "boolean") {
      throw new AppError("Accept field must be a boolean", 400);
    }

    const booking = await respondToBookingInvitation(req.user.id, invitationId as string, accept);

    res.status(200).json({
      success: true,
      message: accept ? "Invitation accepted successfully" : "Invitation declined",
      data: booking,
    });
  }
);

/**
 * Get booking invitations for the current user
 * GET /api/bookings/invitations
 */
export const getMyInvitations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  const { status } = req.query;
  const validStatus =
    status === "PENDING" || status === "ACCEPTED" || status === "DECLINED" ? status : undefined;

  const invitations = await getUserBookingInvitations(req.user.id, validStatus);

  res.status(200).json({
    success: true,
    message: "Invitations retrieved successfully",
    data: invitations,
  });
});

/**
 * Organizer covers unpaid shares in a split payment booking
 * POST /api/bookings/:bookingId/cover-payments
 */
export const coverUnpaidPayments = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { bookingId } = req.params;

    if (!bookingId || typeof bookingId !== "string") {
      throw new AppError("Invalid booking ID", 400);
    }

    const booking = await coverUnpaidShares(bookingId as string, req.user.id);

    res.status(200).json({
      success: true,
      message: "Unpaid shares covered successfully",
      data: booking,
    });
  }
);

/**
 * Get count of pending booking invitations
 * GET /api/bookings/invitations/pending-count
 */
export const getPendingInvitationsCount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const count = await countUserBookingInvitations(req.user.id, "PENDING");

    res.status(200).json({
      success: true,
      data: { count },
    });
  }
);
