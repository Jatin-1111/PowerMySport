import { Request, Response } from "express";
import {
  getAllAdmins,
  setAdminActiveStatus,
  updateAdmin,
  updateAdminPermissions,
  updateAdminRole,
  getRoleTemplatesData,
} from "../../services/AdminService";
import { recordAuditLog, listAuditLogs } from "../../services/AuditLogService";
import { auditContext, normalizeAdminResponse } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

// Get all admins (super admin only)
export const listAdmins = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const admins = await getAllAdmins();

  res.status(200).json({
    success: true,
    message: "Admins retrieved successfully",
    data: admins.map((admin) => normalizeAdminResponse(admin)),
  });
});

/**
 * Admin: List audit log entries (Super Admin only)
 * GET /api/admin/audit-logs?page=1&limit=25
 */
export const listAuditLogsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const adminId = typeof req.query.adminId === "string" ? req.query.adminId : undefined;
    const targetType = typeof req.query.targetType === "string" ? req.query.targetType : undefined;

    const result = await listAuditLogs(page, limit, {
      ...(adminId ? { adminId } : {}),
      ...(targetType ? { targetType } : {}),
    });

    res.status(200).json({
      success: true,
      message: "Audit logs retrieved successfully",
      data: result.logs,
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  }
);

// Get role templates
export const getRoleTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const templates = getRoleTemplatesData();

  res.status(200).json({
    success: true,
    message: "Role templates retrieved successfully",
    data: templates,
  });
});

// Update admin permissions
export const updateAdminPermissionsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { adminId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      throw new AppError("Permissions must be an array", 400);
    }

    const updatedAdmin = await updateAdminPermissions(adminId as string, permissions as string[]);

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: "admin.updatePermissions",
        targetType: "Admin",
        targetId: adminId as string,
        metadata: { permissions },
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin permissions updated successfully",
      data: normalizeAdminResponse(updatedAdmin),
    });
  }
);

// Update admin role
export const updateAdminRoleHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { adminId } = req.params;
    const { role } = req.body;

    if (!role) {
      throw new AppError("Role is required", 400);
    }

    const updatedAdmin = await updateAdminRole(adminId as string, role as string);

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: "admin.updateRole",
        targetType: "Admin",
        targetId: adminId as string,
        metadata: { role },
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin role updated successfully",
      data: normalizeAdminResponse(updatedAdmin),
    });
  }
);

// Update admin name
export const updateAdminProfileHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { adminId } = req.params;
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      throw new AppError("Name is required", 400);
    }

    const updatedAdmin = await updateAdmin(adminId as string, {
      name: name.trim(),
    });

    if (!updatedAdmin) {
      throw new AppError("Admin not found", 404);
    }

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: "admin.updateProfile",
        targetType: "Admin",
        targetId: adminId as string,
        metadata: { name: name.trim() },
      });
    }

    res.status(200).json({
      success: true,
      message: "Admin profile updated successfully",
      data: normalizeAdminResponse(updatedAdmin),
    });
  }
);

// Activate or deactivate an admin account
export const updateAdminStatusHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { adminId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      throw new AppError("isActive must be a boolean", 400);
    }

    if (!isActive && req.user?.id === adminId) {
      throw new AppError("You cannot deactivate your own account", 400);
    }

    const updatedAdmin = await setAdminActiveStatus(adminId as string, isActive);

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: isActive ? "admin.activate" : "admin.deactivate",
        targetType: "Admin",
        targetId: adminId as string,
      });
    }

    res.status(200).json({
      success: true,
      message: `Admin ${isActive ? "activated" : "deactivated"} successfully`,
      data: normalizeAdminResponse(updatedAdmin),
    });
  }
);
