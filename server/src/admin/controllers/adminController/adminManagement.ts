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

// Get all admins (super admin only)
export const listAdmins = async (req: Request, res: Response): Promise<void> => {
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

/**
 * Admin: List audit log entries (Super Admin only)
 * GET /api/admin/audit-logs?page=1&limit=25
 */
export const listAuditLogsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get audit logs",
    });
  }
};

// Get role templates
export const getRoleTemplates = async (req: Request, res: Response): Promise<void> => {
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
      message: error instanceof Error ? error.message : "Failed to get role templates",
    });
  }
};

// Update admin permissions
export const updateAdminPermissionsHandler = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update permissions",
    });
  }
};

// Update admin role
export const updateAdminRoleHandler = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update role",
    });
  }
};

// Update admin name
export const updateAdminProfileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { adminId } = req.params;
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        success: false,
        message: "Name is required",
      });
      return;
    }

    const updatedAdmin = await updateAdmin(adminId as string, {
      name: name.trim(),
    });

    if (!updatedAdmin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update profile",
    });
  }
};

// Activate or deactivate an admin account
export const updateAdminStatusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { adminId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
      return;
    }

    if (!isActive && req.user?.id === adminId) {
      res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update status",
    });
  }
};
