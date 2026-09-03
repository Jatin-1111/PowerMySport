import { Request, Response } from "express";
import {
  initiateGroupBooking,
  respondToBookingInvitation,
  coverUnpaidShares,
  getUserBookingInvitations,
  countUserBookingInvitations,
} from "../../services/BookingService";

// ============================================
// GROUP BOOKING ENDPOINTS
// ============================================

/**
 * Initiate a group booking with friends
 * POST /api/bookings/initiate-group
 */
export const initiateNewGroupBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (req.user.role !== "Player" && req.user.role !== "Parent") {
      res.status(403).json({
        success: false,
        message: "Group booking is available for player and parent accounts.",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to initiate group booking",
    });
  }
};

/**
 * Respond to a booking invitation
 * POST /api/bookings/invitations/:invitationId/respond
 */
export const respondToInvitation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { invitationId } = req.params;
    const { accept } = req.body;

    if (!invitationId || typeof invitationId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid invitation ID",
      });
      return;
    }

    if (typeof accept !== "boolean") {
      res.status(400).json({
        success: false,
        message: "Accept field must be a boolean",
      });
      return;
    }

    const booking = await respondToBookingInvitation(req.user.id, invitationId as string, accept);

    res.status(200).json({
      success: true,
      message: accept ? "Invitation accepted successfully" : "Invitation declined",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to respond to invitation",
    });
  }
};

/**
 * Get booking invitations for the current user
 * GET /api/bookings/invitations
 */
export const getMyInvitations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get invitations",
    });
  }
};

/**
 * Organizer covers unpaid shares in a split payment booking
 * POST /api/bookings/:bookingId/cover-payments
 */
export const coverUnpaidPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { bookingId } = req.params;

    if (!bookingId || typeof bookingId !== "string") {
      res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
      return;
    }

    const booking = await coverUnpaidShares(bookingId as string, req.user.id);

    res.status(200).json({
      success: true,
      message: "Unpaid shares covered successfully",
      data: booking,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to cover unpaid shares",
    });
  }
};

/**
 * Get count of pending booking invitations
 * GET /api/bookings/invitations/pending-count
 */
export const getPendingInvitationsCount = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const count = await countUserBookingInvitations(req.user.id, "PENDING");

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get invitations count",
    });
  }
};
