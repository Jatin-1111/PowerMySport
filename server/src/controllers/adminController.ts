import { Request, Response } from "express";
import {
  loginAdmin,
  createAdmin,
  getAdminById,
  getAllAdmins,
} from "../services/AdminService";

// Admin login
export const adminLogin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const result = await loginAdmin({ email, password });

    // Set cookie
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: {
        admin: result.admin,
        token: result.token,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : "Login failed",
    });
  }
};

// Create admin (super admin only)
export const createAdminAccount = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const admin = await createAdmin(req.body);

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: admin,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create admin",
    });
  }
};

// Get admin profile
export const getAdminProfile = async (
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

    const admin = await getAdminById(req.user.id);

    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Admin profile retrieved",
      data: admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get profile",
    });
  }
};

// Get all admins (super admin only)
export const listAdmins = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const admins = await getAllAdmins();

    res.status(200).json({
      success: true,
      message: "Admins retrieved successfully",
      data: admins,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get admins",
    });
  }
};

// Admin logout
export const adminLogout = async (
  req: Request,
  res: Response,
): Promise<void> => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};

/**
 * Process refund for a booking (STUB - requires payment gateway integration)
 * POST /api/admin/refunds/:bookingId
 *
 * Future implementation:
 * - Verify booking exists and is eligible for refund
 * - Calculate refund amount based on cancellation policy
 * - Process refund through payment gateway
 * - Update booking payment status
 * - Notify player, venue owner, and coach
 */
export const processRefund = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;
    const { refundType, reason } = req.body;

    // TODO: Implement actual refund logic when payment gateway is integrated
    // Current implementation is a stub for route structure

    res.status(501).json({
      success: false,
      message:
        "Refund processing not implemented yet - payment gateway required",
      data: {
        bookingId,
        refundType, // 'FULL' | 'PARTIAL' | 'VENUE_ONLY' | 'COACH_ONLY'
        reason,
        note: "This endpoint will be functional after payment gateway integration",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to process refund",
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
export const handleDispute = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;
    const { disputeType, resolution, evidence } = req.body;

    // TODO: Implement actual dispute handling when payment gateway is integrated
    // Current implementation is a stub for route structure

    res.status(501).json({
      success: false,
      message:
        "Dispute handling not implemented yet - payment gateway required",
      data: {
        bookingId,
        disputeType, // 'NO_SHOW' | 'POOR_QUALITY' | 'PAYMENT_ISSUE' | 'OTHER'
        resolution, // 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_REFUND'
        evidence,
        note: "This endpoint will be functional after payment gateway integration",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to handle dispute",
    });
  }
};

/**
 * Get all bookings for admin review (with filters)
 * GET /api/admin/bookings
 */
export const getAdminBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;

    // TODO: Implement booking filtering and pagination
    // Current implementation is a stub

    res.status(501).json({
      success: false,
      message: "Admin booking list not implemented yet",
      data: {
        filters: { status, startDate, endDate },
        pagination: { page, limit },
        note: "This endpoint will be implemented in future releases",
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
