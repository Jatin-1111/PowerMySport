import { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../../../client/models/User";
import { recordAuditLog } from "../../services/AuditLogService";
import { sendAccountStatusEmail } from "../../../utils/email";
import { auditContext, log } from "./shared";

/**
 * List users for safety operations
 * GET /api/admin/users/safety?role=PLAYER&status=ACTIVE
 */
export const listUsersForSafety = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = typeof req.query.role === "string" ? req.query.role : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      role: { $in: ["Player", "Coach", "VenueLister"] },
    };

    if (role && ["Player", "Coach", "VenueLister"].includes(role)) {
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
          "name email phone role isActive suspensionReason suspendedAt deactivatedAt createdAt lastActiveAt"
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
      message: error instanceof Error ? error.message : "Failed to retrieve users",
    });
  }
};

/**
 * Update user safety status
 * PATCH /api/admin/users/:userId/safety
 */
export const updateUserSafetyStatus = async (req: Request, res: Response): Promise<void> => {
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
      update.suspendedBy = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : null;
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
      update.suspensionReason = reason?.trim() || "Account deactivated by admin";
      update.deactivatedAt = new Date();
      update.suspendedAt = new Date();
      update.suspendedBy = req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : null;
    }

    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select(
        "name email phone role isActive suspensionReason suspendedAt deactivatedAt createdAt lastActiveAt"
      )
      .lean();

    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Notify the user their account status changed (fire-and-forget).
    if (user.email) {
      sendAccountStatusEmail({
        name: user.name,
        email: user.email,
        action,
        reason: reason?.trim() || undefined,
      }).catch((error) => log.error("Failed to send account status email:", error));
    }

    const auditSafety = auditContext(req);
    if (auditSafety) {
      void recordAuditLog({
        ...auditSafety,
        action: `user.${action.toLowerCase()}`,
        targetType: "User",
        targetId: userId,
        metadata: { reason },
      });
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
      message: error instanceof Error ? error.message : "Failed to update user safety status",
    });
  }
};
