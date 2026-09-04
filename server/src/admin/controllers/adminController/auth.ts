import { Request, Response } from "express";
import {
  changeAdminPassword,
  createAdmin,
  getAdminById,
  loginAdmin,
} from "../../services/AdminService";
import { recordAuditLog } from "../../services/AuditLogService";
import { auditContext, normalizeAdminResponse } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

// Admin login
export const adminLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
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
});

// Create admin (super admin only)
export const createAdminAccount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { name, email, role, permissions } = req.body;

    if (!name || !email) {
      throw new AppError("Name and email are required", 400);
    }

    const admin = await createAdmin({
      name,
      email,
      ...(role ? { role } : {}),
      ...(Array.isArray(permissions) ? { permissions } : {}),
    });

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: "admin.create",
        targetType: "Admin",
        targetId: admin._id.toString(),
        metadata: { name, email, role: admin.role },
      });
    }

    res.status(201).json({
      success: true,
      message:
        role === "SYSTEM_ADMIN"
          ? "System admin created successfully. Temporary password has been emailed."
          : "Admin created successfully. Temporary password has been emailed.",
      data: normalizeAdminResponse(admin),
    });
  }
);

export const changeAdminPasswordHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError("Current password and new password are required", 400);
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      throw new AppError("New password must be at least 8 characters", 400);
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
  }
);

// Get admin profile
export const getAdminProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  const admin = await getAdminById(req.user.id);

  if (!admin) {
    throw new AppError("Admin not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Admin profile retrieved",
    data: normalizeAdminResponse(admin),
  });
});

// Admin logout
export const adminLogout = async (req: Request, res: Response): Promise<void> => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
  });

  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
};
