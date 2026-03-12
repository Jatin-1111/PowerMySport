import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/User";
import { CommunityReport } from "../models/CommunityReport";
import {
  changeAdminPassword,
  createAdmin,
  getAdminById,
  getAllAdmins,
  loginAdmin,
  updateAdminPermissions,
  updateAdminRole,
  getRoleTemplatesData,
} from "../services/AdminService";
import {
  getCoachById,
  listCoachVerificationRequests,
  updateCoachVerificationStatus,
} from "../services/CoachService";
import {
  sendCoachVerificationReminderEmail,
  sendCoachVerificationStatusEmail,
} from "../utils/email";
import { NotificationService } from "../services/NotificationService";

const normalizeAdminResponse = (admin: unknown) => {
  if (!admin || typeof admin !== "object") {
    return admin;
  }

  const objectValue = admin as { toObject?: () => Record<string, unknown> };
  const plain =
    typeof objectValue.toObject === "function"
      ? objectValue.toObject()
      : (admin as Record<string, unknown>);

  const idSource = plain._id;
  const id =
    typeof plain.id === "string"
      ? plain.id
      : idSource &&
          typeof (idSource as { toString?: () => string }).toString ===
            "function"
        ? (idSource as { toString: () => string }).toString()
        : "";

  return {
    ...plain,
    id,
  };
};

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
        admin: normalizeAdminResponse(result.admin),
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
    const { name, email, role, permissions } = req.body;

    if (!name || !email) {
      res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
      return;
    }

    const admin = await createAdmin({
      name,
      email,
      ...(role ? { role } : {}),
      ...(Array.isArray(permissions) ? { permissions } : {}),
    });

    res.status(201).json({
      success: true,
      message:
        role === "SYSTEM_ADMIN"
          ? "System admin created successfully. Temporary password has been emailed."
          : "Admin created successfully. Temporary password has been emailed.",
      data: normalizeAdminResponse(admin),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create admin",
    });
  }
};

export const changeAdminPasswordHandler = async (
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

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
      return;
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
      return;
    }

    const updatedAdmin = await changeAdminPassword({
      adminId: req.user.id,
      currentPassword,
      newPassword,
    });

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
      data: normalizeAdminResponse(updatedAdmin),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to change password",
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
      data: normalizeAdminResponse(admin),
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
      data: admins.map((admin) => normalizeAdminResponse(admin)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get admins",
    });
  }
};

// Get role templates
export const getRoleTemplates = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const templates = getRoleTemplatesData();

    res.status(200).json({
      success: true,
      message: "Role templates retrieved successfully",
      data: templates,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get role templates",
    });
  }
};

// Update admin permissions
export const updateAdminPermissionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { adminId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      res.status(400).json({
        success: false,
        message: "Permissions must be an array",
      });
      return;
    }

    const updatedAdmin = await updateAdminPermissions(
      adminId as string,
      permissions as string[],
    );

    res.status(200).json({
      success: true,
      message: "Admin permissions updated successfully",
      data: normalizeAdminResponse(updatedAdmin),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update permissions",
    });
  }
};

// Update admin role
export const updateAdminRoleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { adminId } = req.params;
    const { role } = req.body;

    if (!role) {
      res.status(400).json({
        success: false,
        message: "Role is required",
      });
      return;
    }

    const updatedAdmin = await updateAdminRole(
      adminId as string,
      role as string,
    );

    res.status(200).json({
      success: true,
      message: "Admin role updated successfully",
      data: normalizeAdminResponse(updatedAdmin),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update role",
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
 * List users for safety operations
 * GET /api/admin/users/safety?role=PLAYER&status=ACTIVE
 */
export const listUsersForSafety = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const role =
      typeof req.query.role === "string" ? req.query.role : undefined;
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      role: { $in: ["PLAYER", "COACH", "VENUE_LISTER"] },
    };

    if (role && ["PLAYER", "COACH", "VENUE_LISTER"].includes(role)) {
      query.role = role;
    }

    if (status === "ACTIVE") {
      // Legacy users created before safety rollout may not have isActive persisted.
      // Treat anything except explicit false as active.
      query.isActive = { $ne: false };
    } else if (status === "SUSPENDED") {
      query.isActive = false;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select(
          "name email phone role isActive suspensionReason suspendedAt deactivatedAt createdAt lastActiveAt",
        )
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "User safety list retrieved",
      data: users.map((user) => ({
        id: user._id.toString(),
        ...user,
        isActive: user.isActive !== false,
      })),
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to retrieve users",
    });
  }
};

/**
 * Update user safety status
 * PATCH /api/admin/users/:userId/safety
 */
export const updateUserSafetyStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req.params as Record<string, unknown>).userId as string;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ success: false, message: "Invalid user id" });
      return;
    }

    const { action, reason } = req.body as {
      action?: "SUSPEND" | "REACTIVATE" | "DEACTIVATE";
      reason?: string;
    };

    if (!action || !["SUSPEND", "REACTIVATE", "DEACTIVATE"].includes(action)) {
      res.status(400).json({
        success: false,
        message: "action must be SUSPEND, REACTIVATE, or DEACTIVATE",
      });
      return;
    }

    const update: Record<string, unknown> = {};

    if (action === "SUSPEND") {
      if (!reason?.trim()) {
        res.status(400).json({
          success: false,
          message: "reason is required for SUSPEND",
        });
        return;
      }

      update.isActive = false;
      update.suspensionReason = reason.trim();
      update.suspendedAt = new Date();
      update.deactivatedAt = null;
      update.suspendedBy = req.user?.id
        ? new mongoose.Types.ObjectId(req.user.id)
        : null;
    }

    if (action === "REACTIVATE") {
      update.isActive = true;
      update.suspensionReason = "";
      update.suspendedAt = null;
      update.deactivatedAt = null;
      update.suspendedBy = null;
    }

    if (action === "DEACTIVATE") {
      update.isActive = false;
      update.suspensionReason =
        reason?.trim() || "Account deactivated by admin";
      update.deactivatedAt = new Date();
      update.suspendedAt = new Date();
      update.suspendedBy = req.user?.id
        ? new mongoose.Types.ObjectId(req.user.id)
        : null;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true },
    )
      .select(
        "name email phone role isActive suspensionReason suspendedAt deactivatedAt createdAt lastActiveAt",
      )
      .lean();

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: `User ${action.toLowerCase()} successful`,
      data: {
        id: user._id.toString(),
        ...user,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update user safety status",
    });
  }
};

export const listCommunityReports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query = status
      ? { status }
      : { status: { $in: ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] } };

    const [reports, total] = await Promise.all([
      CommunityReport.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CommunityReport.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      message: "Community reports fetched",
      data: reports.map((report) => ({
        id: String(report._id),
        reporterUserId: String(report.reporterUserId),
        targetType: report.targetType,
        targetId: String(report.targetId),
        reason: report.reason,
        details: report.details || "",
        status: report.status,
        resolutionNote: report.resolutionNote || "",
        reviewedBy: report.reviewedBy ? String(report.reviewedBy) : null,
        reviewedAt: report.reviewedAt || null,
        createdAt: report.createdAt,
      })),
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch community reports",
    });
  }
};

export const reviewCommunityReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const reportId = String(req.params.reportId || "");
    if (!reportId || !mongoose.Types.ObjectId.isValid(reportId)) {
      res.status(400).json({ success: false, message: "Invalid report id" });
      return;
    }

    const { status, resolutionNote } = req.body as {
      status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
      resolutionNote?: string;
    };

    const updated = await CommunityReport.findByIdAndUpdate(
      reportId,
      {
        $set: {
          status,
          resolutionNote: resolutionNote?.trim() || "",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Report updated",
      data: {
        id: String(updated._id),
        status: updated.status,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update community report",
    });
  }
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
 * List coach verification requests
 * GET /api/admin/coaches/verification?status=PENDING&page=1&limit=20
 */
export const listCoachVerifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const status = req.query.status as
      | "UNVERIFIED"
      | "PENDING"
      | "REVIEW"
      | "VERIFIED"
      | "REJECTED"
      | undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);

    const result = await listCoachVerificationRequests(status, page, limit);

    res.status(200).json({
      success: true,
      message: "Coach verification requests retrieved",
      data: result.coaches,
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
        error instanceof Error
          ? error.message
          : "Failed to fetch coach verifications",
    });
  }
};

/**
 * Get single coach details for admin verification review
 * GET /api/admin/coaches/:coachId
 */
export const getCoachVerificationDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const coach = await getCoachById(coachId);

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Coach details retrieved",
      data: normalizeAdminResponse(coach),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch coach details",
    });
  }
};

/**
 * Approve coach verification
 * POST /api/admin/coaches/:coachId/verify
 */
export const approveCoachVerification = async (
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

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const coach = await updateCoachVerificationStatus(
      coachId,
      "VERIFIED",
      req.user.id,
    );

    try {
      const user = await User.findById(coach.userId);
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "VERIFIED",
        });
      }

      // Send in-app notification
      if (user?._id) {
        NotificationService.send({
          userId: user._id.toString(),
          type: "COACH_VERIFICATION_VERIFIED",
          title: "Coach Verification Approved",
          message: "Congratulations! Your coach profile has been verified.",
          data: {
            coachId: coachId,
            verifiedAt: new Date().toISOString(),
          },
        }).catch((err: Error) =>
          console.error("Failed to send verification notification:", err),
        );
      }
    } catch (emailError) {
      console.error("Failed to send coach verification email:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Coach verified successfully",
      data: coach,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to verify coach",
    });
  }
};

/**
 * Reject coach verification
 * POST /api/admin/coaches/:coachId/reject
 */
export const rejectCoachVerification = async (
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

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const { reason } = req.body as { reason?: string };
    if (!reason) {
      res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
      return;
    }

    const coach = await updateCoachVerificationStatus(
      coachId,
      "REJECTED",
      req.user.id,
      reason,
    );

    try {
      const user = await User.findById(coach.userId);
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "REJECTED",
          notes: reason,
        });
      }

      // Send in-app notification
      if (user?._id) {
        NotificationService.send({
          userId: user._id.toString(),
          type: "COACH_VERIFICATION_REJECTED",
          title: "Coach Verification Rejected",
          message: "Your coach verification request has been rejected.",
          data: {
            coachId: coachId,
            reason: reason,
            rejectedAt: new Date().toISOString(),
          },
        }).catch((err: Error) =>
          console.error("Failed to send rejection notification:", err),
        );
      }
    } catch (emailError) {
      console.error("Failed to send coach verification email:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Coach verification rejected",
      data: coach,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to reject coach",
    });
  }
};

/**
 * Mark coach verification for review
 * POST /api/admin/coaches/:coachId/mark-review
 */
export const markCoachVerificationForReview = async (
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

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const { notes } = req.body as { notes?: string };

    const coach = await updateCoachVerificationStatus(
      coachId,
      "REVIEW",
      req.user.id,
      notes,
    );

    try {
      const user = await User.findById(coach.userId);
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "REVIEW",
          ...(notes ? { notes } : {}),
        });
      }

      // Send in-app notification
      if (user?._id) {
        NotificationService.send({
          userId: user._id.toString(),
          type: "COACH_VERIFICATION_REVIEW",
          title: "Coach Verification Under Review",
          message: "Your coach verification is under review by our team.",
          data: {
            coachId: coachId,
            notes: notes || "",
            reviewStartedAt: new Date().toISOString(),
          },
        }).catch((err: Error) =>
          console.error("Failed to send review notification:", err),
        );
      }
    } catch (emailError) {
      console.error("Failed to send coach verification email:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Coach verification marked for review",
      data: coach,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to mark coach for review",
    });
  }
};

/**
 * Notify coach to complete/submit verification
 * POST /api/admin/coaches/:coachId/notify
 */
export const notifyCoachVerificationPending = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const REMINDER_COOLDOWN_MS =1000;

    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const coach = await getCoachById(coachId);

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    if (coach.verificationStatus === "VERIFIED") {
      res.status(400).json({
        success: false,
        message: "Coach is already verified",
      });
      return;
    }

    if (coach.lastVerificationReminderAt) {
      const elapsedMs =
        Date.now() - new Date(coach.lastVerificationReminderAt).getTime();
      if (elapsedMs < REMINDER_COOLDOWN_MS) {
        const remainingMs = REMINDER_COOLDOWN_MS - elapsedMs;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        res.status(429).json({
          success: false,
          message: `Reminder cooldown active. Try again in ${remainingMinutes} minute(s).`,
        });
        return;
      }
    }

    const user = await User.findById(coach.userId).select("_id name email");
    if (!user?._id) {
      res.status(404).json({
        success: false,
        message: "Coach user not found",
      });
      return;
    }

    if (!user.email) {
      res.status(400).json({
        success: false,
        message: "Coach does not have an email address",
      });
      return;
    }

    await sendCoachVerificationReminderEmail({
      name: user.name || "Coach",
      email: user.email,
    });

    coach.lastVerificationReminderAt = new Date();
    await coach.save();

    NotificationService.send({
      userId: user._id.toString(),
      type: "COACH_VERIFICATION_PENDING",
      title: "Complete Your Coach Verification",
      message:
        "Please complete and submit your coach verification profile and documents for admin review.",
      data: {
        coachId,
        currentStatus: coach.verificationStatus || "UNVERIFIED",
        remindedAt: new Date().toISOString(),
      },
    }).catch((err: Error) =>
      console.error("Failed to send in-app verification reminder:", err),
    );

    res.status(200).json({
      success: true,
      message: "Verification reminder email sent",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to send verification reminder",
    });
  }
};
