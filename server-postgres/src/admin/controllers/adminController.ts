import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import type {
  CoachVerificationStatus,
  CommunityReportStatus,
  VenueApprovalStatus,
} from "@prisma/client";
import prisma from "../../lib/prisma";
import { S3Service } from "../../shared/services/S3Service";
import { WebhookRecoveryService } from "../../shared/controllers/WebhookController";
import {
  changeAdminPassword,
  createAdmin,
  getAdminById,
  getAllAdmins,
  loginAdmin,
  setAdminActiveStatus,
  updateAdmin,
  updateAdminPermissions,
  updateAdminRole,
  getRoleTemplatesData,
} from "../services/AdminService";
import { recordAuditLog, listAuditLogs } from "../services/AuditLogService";
import {
  getCoachById,
  listCoachVerificationRequests,
  updateCoachVerificationStatus,
  updateCoach,
  submitCoachVerification,
} from "../../client/services/CoachService";
import {
  getBookingPhonePeRefundStatus,
  processBookingRefund,
} from "../../client/services/BookingService";
import { transformDocument } from "../../middleware/responseTransform";
import {
  sendCoachVerificationReminderEmail,
  sendCoachVerificationStatusEmail,
  sendCoachAdminCredentialsEmail,
  sendVenueAdminCredentialsEmail,
  sendAccountStatusEmail,
  sendDisputeStatusEmail,
} from "../../utils/email";
import { NotificationService } from "../../client/services/NotificationService";
import { isPhonePeGatewayError } from "../../shared/services/PhonePeService";

const auditContext = (
  req: Request,
): { adminId: string; adminEmail: string } | null => {
  if (!req.user?.id || !req.user.email) return null;
  return { adminId: req.user.id, adminEmail: req.user.email };
};

// bcrypt work factor for admin-provisioned accounts. In Mongo this was a
// User pre-save hook; with Prisma there is no hook, so temp passwords created
// here must be hashed explicitly before write (see PORTING_GUIDE §3).
const BCRYPT_COST = 12;
const hashTempPassword = async (plain: string): Promise<string> => {
  const salt = await bcrypt.genSalt(BCRYPT_COST);
  return bcrypt.hash(plain, salt);
};

// A coach returned from CoachService may carry `userId` either as a plain
// String FK or as an already-joined user object; extract the id in both cases.
const extractUserId = (value: unknown): string =>
  value && typeof value === "object"
    ? String((value as { id?: string }).id ?? "")
    : String(value ?? "");

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

const generateTempPassword = (length = 12): string => {
  const desiredLength = Math.max(8, length);
  let password = "";

  while (password.length < desiredLength) {
    password += crypto.randomBytes(16).toString("base64url");
    password = password.replace(/[^a-zA-Z0-9]/g, "");
  }

  return password.slice(0, desiredLength);
};

const buildUserSummary = (user: {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}) => ({
  id: user.id || "",
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
});

const normalizeCoachResponse = (coach: unknown) => {
  if (!coach || typeof coach !== "object") {
    return coach;
  }

  const objectValue = coach as { toObject?: () => Record<string, unknown> };
  const plain =
    typeof objectValue.toObject === "function"
      ? objectValue.toObject()
      : (coach as Record<string, unknown>);

  return {
    ...plain,
    id:
      typeof plain.id === "string"
        ? plain.id
        : plain._id &&
            typeof plain._id === "object" &&
            typeof (plain._id as { toString?: () => string }).toString ===
              "function"
          ? (plain._id as { toString: () => string }).toString()
          : "",
  };
};

// Reconstruct the previously-embedded coach shape (sportPricing map,
// baseLocation GeoJSON, ownVenueDetails) from the normalized Prisma children,
// mirroring CoachService.mapCoachRecord so the admin list response keeps the
// legacy JSON shape.
const mapAdminCoachRecord = (coach: any, user: unknown) => {
  const {
    ownVenue,
    sportPricing: rawSportPricing,
    availability,
    sportAvailability,
    documents,
    blockedDates,
    payoutMethods,
    ...scalar
  } = coach;

  const sportPricing: Record<string, number> = {};
  for (const sp of rawSportPricing ?? []) {
    sportPricing[sp.sport] = sp.price;
  }

  const baseLocation =
    coach.baseLng != null && coach.baseLat != null
      ? {
          type: "Point" as const,
          coordinates: [coach.baseLng, coach.baseLat] as [number, number],
        }
      : undefined;

  const ownVenueDetails = ownVenue
    ? {
        name: ownVenue.name,
        address: ownVenue.address,
        location: {
          type: "Point" as const,
          coordinates: [ownVenue.lng ?? 0, ownVenue.lat ?? 0] as [
            number,
            number,
          ],
        },
        sports: ownVenue.sports,
        amenities: ownVenue.amenities,
        pricePerHour: ownVenue.pricePerHour,
        description: ownVenue.description,
        images: ownVenue.images,
        imageS3Keys: ownVenue.imageS3Keys,
        openingHours: ownVenue.openingHours,
      }
    : undefined;

  return normalizeCoachResponse({
    ...scalar,
    sportPricing,
    baseLocation,
    ownVenueDetails,
    userId: user ?? coach.userId,
  });
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

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: "admin.create",
        targetType: "Admin",
        targetId: admin.id.toString(),
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

/**
 * Admin: List audit log entries (Super Admin only)
 * GET /api/admin/audit-logs?page=1&limit=25
 */
export const listAuditLogsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const adminId =
      typeof req.query.adminId === "string" ? req.query.adminId : undefined;
    const targetType =
      typeof req.query.targetType === "string"
        ? req.query.targetType
        : undefined;

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
      message:
        error instanceof Error ? error.message : "Failed to get audit logs",
    });
  }
};

/**
 * Admin: List coaches
 * GET /api/admin/coaches
 */
export const listCoaches = async (
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

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    const statusFilter =
      typeof req.query.status === "string" ? req.query.status.trim() : "";

    const where: Record<string, unknown> = {};
    if (statusFilter && statusFilter !== "ALL") {
      where.verificationStatus = statusFilter as CoachVerificationStatus;
    }

    const [total, coaches] = await Promise.all([
      prisma.coach.count({ where }),
      prisma.coach.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          ownVenue: true,
          sportPricing: true,
          availability: true,
          sportAvailability: true,
          documents: true,
          blockedDates: true,
          payoutMethods: true,
        },
      }),
    ]);

    // Populate the user for each coach (String FK, no relation) — mirror the
    // legacy `.populate("userId", "_id name email phone photoUrl photoS3Key role")`.
    const userIds = [...new Set(coaches.map((coach) => coach.userId))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            photoUrl: true,
            photoS3Key: true,
            role: true,
          },
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    res.status(200).json({
      success: true,
      message: "Coaches retrieved successfully",
      data: coaches.map((coach) =>
        mapAdminCoachRecord(coach, usersById.get(coach.userId) ?? null),
      ),
      pagination: {
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch coaches",
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
export const updateAdminProfileHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
      message:
        error instanceof Error ? error.message : "Failed to update profile",
    });
  }
};

// Activate or deactivate an admin account
export const updateAdminStatusHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
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

    const updatedAdmin = await setAdminActiveStatus(
      adminId as string,
      isActive,
    );

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
      message:
        error instanceof Error ? error.message : "Failed to update status",
    });
  }
};

/**
 * Admin: Get presigned upload URL for coach verification documents / venue images
 * POST /api/admin/coaches/:coachId/verification/upload-url
 */
export const getAdminCoachVerificationUploadUrlHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    if (!coachId) {
      res.status(400).json({ success: false, message: "coachId is required" });
      return;
    }

    const coach = await getCoachById(coachId);
    if (!coach) {
      res.status(404).json({ success: false, message: "Coach not found" });
      return;
    }

    const { fileName, contentType, documentType, purpose } = req.body as {
      fileName?: string;
      contentType?: string;
      documentType?: string;
      purpose?: "DOCUMENT" | "VENUE_IMAGE";
    };

    if (!fileName || !contentType) {
      res.status(400).json({
        success: false,
        message: "fileName and contentType are required",
      });
      return;
    }

    const s3Service = new S3Service();

    const uploadData =
      purpose === "VENUE_IMAGE"
        ? await s3Service.generateCoachVenueImageUploadUrl(
            fileName,
            contentType,
            coach.id.toString(),
          )
        : await s3Service.generateCoachVerificationUploadUrl(
            fileName,
            contentType,
            coach.id.toString(),
            (documentType as any) || "OTHER",
          );

    res.status(200).json({
      success: true,
      message:
        purpose === "VENUE_IMAGE"
          ? "Venue image upload URL generated"
          : "Verification document upload URL generated",
      data: uploadData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate upload URL",
    });
  }
};

/**
 * Admin: Update coach profile (partial) by coachId
 * PUT /api/admin/coaches/:coachId
 */
export const updateCoachAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    if (!coachId) {
      res.status(400).json({ success: false, message: "coachId is required" });
      return;
    }

    // Strip fields an admin must not set via the generic coach update — these
    // are governed by the dedicated verification flow or derived server-side.
    const updates: Record<string, unknown> = { ...(req.body || {}) };
    for (const f of [
      "isVerified",
      "verificationStatus",
      "userId",
      "createdBy",
      "rating",
      "reviewCount",
      "_id",
    ]) {
      delete updates[f];
    }

    const updated = await updateCoach(coachId, updates as any);
    if (!updated) {
      res.status(404).json({ success: false, message: "Coach not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Coach updated successfully",
      data: transformDocument(updated as any),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update coach",
    });
  }
};

// ============ WEBHOOK RECOVERY ============

/**
 * List webhook errors
 * GET /api/admin/webhook-errors
 */
export const listWebhookErrors = async (req: Request, res: Response) => {
  try {
    const errors = WebhookRecoveryService.listErrors();
    res.status(200).json({
      success: true,
      data: errors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch webhook errors",
    });
  }
};

/**
 * Retry webhook error
 * POST /api/admin/webhook-errors/:key/retry
 */
export const retryWebhookError = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    // We instantiate the service and call retryFailedWebhook
    const recoveryService = new WebhookRecoveryService();
    await recoveryService.retryFailedWebhook(key as string);

    res.status(200).json({
      success: true,
      message: "Webhook retry executed",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to retry webhook",
    });
  }
};

/**
 * Reconcile order
 * POST /api/admin/reconcile/:type/:orderId
 */
export const reconcileOrderAdmin = async (req: Request, res: Response) => {
  try {
    const type = req.params.type as string;
    const orderId = req.params.orderId as string;

    const recoveryService = new WebhookRecoveryService();
    let consistent = false;
    let details = {};

    if (type === "booking" || type === "payment") {
      consistent = await recoveryService.reconcileOrderPayment(orderId);
      details = { status: "CHECKED_PAYMENT" };
    } else if (type === "refund") {
      consistent = await recoveryService.reconcileOrderRefund(orderId);
      details = { status: "CHECKED_REFUND" };
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid reconciliation type" });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        isConsistent: consistent,
        details,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to reconcile order",
    });
  }
};

/**
 * Admin: Submit coach verification on behalf of coach
 * POST /api/admin/coaches/:coachId/verification/submit
 */
export const submitCoachVerificationAdminHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coachId = (req.params as Record<string, unknown>).coachId as string;
    if (!coachId) {
      res.status(400).json({ success: false, message: "coachId is required" });
      return;
    }

    const coach = await getCoachById(coachId);
    if (!coach) {
      res.status(404).json({ success: false, message: "Coach not found" });
      return;
    }

    const payload = req.body as { documents?: any[] };

    const submitted = await submitCoachVerification(
      extractUserId(coach.userId),
      {
        documents: payload.documents || [],
      },
    );

    res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      data: transformDocument(submitted as any),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to submit verification",
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

    const where: Record<string, unknown> = {
      role: { in: ["Player", "Coach", "VenueLister"] },
    };

    if (role && ["Player", "Coach", "VenueLister"].includes(role)) {
      where.role = role;
    }

    if (status === "ACTIVE") {
      // Legacy users created before safety rollout may not have isActive persisted.
      // Treat anything except explicit false as active.
      where.isActive = { not: false };
    } else if (status === "SUSPENDED") {
      where.isActive = false;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: where as any,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          suspensionReason: true,
          suspendedAt: true,
          deactivatedAt: true,
          createdAt: true,
          lastActiveAt: true,
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: where as any }),
    ]);

    res.status(200).json({
      success: true,
      message: "User safety list retrieved",
      data: users.map((user) => ({
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
    // NOTE: Postgres ids are cuids, not Mongo ObjectIds — the old
    // ObjectId.isValid() guard no longer applies; a presence check is used.
    if (!userId) {
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
      update.suspendedBy = req.user?.id ?? null;
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
      update.suspendedBy = req.user?.id ?? null;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: update,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        suspensionReason: true,
        suspendedAt: true,
        deactivatedAt: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    // Notify the user their account status changed (fire-and-forget).
    if (user.email) {
      sendAccountStatusEmail({
        name: user.name,
        email: user.email,
        action,
        reason: reason?.trim() || undefined,
      }).catch((error) =>
        console.error("Failed to send account status email:", error),
      );
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

const TARGET_PREVIEW_MAX_LENGTH = 140;

const truncatePreview = (value: string): string =>
  value.length > TARGET_PREVIEW_MAX_LENGTH
    ? `${value.slice(0, TARGET_PREVIEW_MAX_LENGTH)}…`
    : value;

const resolveCommunityReportTargets = async (
  reports: Array<{ targetType: string; targetId: string }>,
): Promise<Map<string, { preview: string; deleted: boolean } | null>> => {
  const idsByType: Record<"MESSAGE" | "GROUP" | "POST" | "ANSWER", string[]> = {
    MESSAGE: [],
    GROUP: [],
    POST: [],
    ANSWER: [],
  };

  for (const report of reports) {
    if (report.targetType in idsByType) {
      idsByType[report.targetType as keyof typeof idsByType].push(
        report.targetId,
      );
    }
  }

  const result = new Map<
    string,
    { preview: string; deleted: boolean } | null
  >();

  const [messages, groups, posts, answers] = await Promise.all([
    idsByType.MESSAGE.length
      ? prisma.communityMessage.findMany({
          where: { id: { in: idsByType.MESSAGE } },
          select: { id: true, content: true, isDeleted: true },
        })
      : Promise.resolve([]),
    idsByType.GROUP.length
      ? prisma.communityGroup.findMany({
          where: { id: { in: idsByType.GROUP } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    idsByType.POST.length
      ? prisma.communityPost.findMany({
          where: { id: { in: idsByType.POST } },
          select: { id: true, title: true, isDeleted: true },
        })
      : Promise.resolve([]),
    idsByType.ANSWER.length
      ? prisma.communityAnswer.findMany({
          where: { id: { in: idsByType.ANSWER } },
          select: { id: true, content: true, isDeleted: true },
        })
      : Promise.resolve([]),
  ]);

  for (const message of messages) {
    result.set(String(message.id), {
      preview: message.isDeleted
        ? "[message deleted]"
        : truncatePreview(message.content),
      deleted: Boolean(message.isDeleted),
    });
  }
  for (const group of groups) {
    result.set(String(group.id), {
      preview: group.name,
      deleted: false,
    });
  }
  for (const post of posts) {
    result.set(String(post.id), {
      preview: post.isDeleted ? "[post deleted]" : truncatePreview(post.title),
      deleted: Boolean(post.isDeleted),
    });
  }
  for (const answer of answers) {
    result.set(String(answer.id), {
      preview: answer.isDeleted
        ? "[answer deleted]"
        : truncatePreview(answer.content),
      deleted: Boolean(answer.isDeleted),
    });
  }

  return result;
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

    const where = status
      ? { status: status as CommunityReportStatus }
      : {
          status: {
            in: [
              "OPEN",
              "UNDER_REVIEW",
              "RESOLVED",
              "REJECTED",
            ] as CommunityReportStatus[],
          },
        };

    const [reports, total] = await Promise.all([
      prisma.communityReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.communityReport.count({ where }),
    ]);

    // Populate reporter (User) and reviewer (Admin) via String FKs.
    const reporterIds = [
      ...new Set(reports.map((report) => report.reporterUserId)),
    ];
    const reviewerIds = [
      ...new Set(
        reports
          .map((report) => report.reviewedBy)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [reporters, reviewers] = await Promise.all([
      reporterIds.length
        ? prisma.user.findMany({
            where: { id: { in: reporterIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      reviewerIds.length
        ? prisma.admin.findMany({
            where: { id: { in: reviewerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const reportersById = new Map(reporters.map((user) => [user.id, user]));
    const reviewersById = new Map(reviewers.map((admin) => [admin.id, admin]));

    const targetPreviews = await resolveCommunityReportTargets(reports);

    res.status(200).json({
      success: true,
      message: "Community reports fetched",
      data: reports.map((report) => {
        const reporter = reportersById.get(report.reporterUserId) || null;
        const reviewer = report.reviewedBy
          ? reviewersById.get(report.reviewedBy) || null
          : null;
        const target = targetPreviews.get(String(report.targetId)) || null;

        return {
          id: String(report.id),
          reporterUserId: reporter
            ? {
                id: String(reporter.id),
                name: reporter.name || "Unknown user",
                email: reporter.email || "",
              }
            : {
                id: String(report.reporterUserId),
                name: "Unknown user",
                email: "",
              },
          targetType: report.targetType,
          targetId: String(report.targetId),
          targetPreview: target
            ? target.preview
            : "[content not found — may have been removed]",
          targetDeleted: target ? target.deleted : true,
          reason: report.reason,
          details: report.details || "",
          status: report.status,
          resolutionNote: report.resolutionNote || "",
          reviewedBy: reviewer
            ? {
                id: String(reviewer.id),
                name: reviewer.name || "Unknown admin",
              }
            : null,
          reviewedAt: report.reviewedAt || null,
          createdAt: report.createdAt,
        };
      }),
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
    if (!reportId) {
      res.status(400).json({ success: false, message: "Invalid report id" });
      return;
    }

    const { status, resolutionNote } = req.body as {
      status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
      resolutionNote?: string;
    };

    const existing = await prisma.communityReport.findUnique({
      where: { id: reportId },
      select: { id: true },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: "Report not found" });
      return;
    }

    const updated = await prisma.communityReport.update({
      where: { id: reportId },
      data: {
        status: status as CommunityReportStatus,
        resolutionNote: resolutionNote?.trim() || "",
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
      select: { id: true, status: true, reviewedAt: true },
    });

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "communityReport.review",
      targetType: "CommunityReport",
      targetId: reportId,
      metadata: { status, resolutionNote },
    });

    res.status(200).json({
      success: true,
      message: "Report updated",
      data: {
        id: String(updated.id),
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
 * Bulk-review community reports (resolve/reject several at once)
 * PATCH /api/admin/community/reports/bulk-review
 */
export const bulkReviewCommunityReports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { reportIds, status, resolutionNote } = req.body as {
      reportIds: string[];
      status: "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
      resolutionNote?: string;
    };

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      res
        .status(400)
        .json({
          success: false,
          message: "reportIds must be a non-empty array",
        });
      return;
    }

    // Postgres ids are cuids — the old ObjectId.isValid() filter no longer
    // applies; keep only non-empty string ids.
    const validIds = reportIds.filter(
      (id) => typeof id === "string" && id.trim().length > 0,
    );
    if (validIds.length === 0) {
      res.status(400).json({ success: false, message: "No valid report ids" });
      return;
    }

    if (!["UNDER_REVIEW", "RESOLVED", "REJECTED"].includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return;
    }

    const result = await prisma.communityReport.updateMany({
      where: { id: { in: validIds } },
      data: {
        status: status as CommunityReportStatus,
        resolutionNote: resolutionNote?.trim() || "",
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
      },
    });

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "communityReport.bulkReview",
      targetType: "CommunityReport",
      metadata: {
        reportIds: validIds,
        status,
        modifiedCount: result.count,
      },
    });

    res.status(200).json({
      success: true,
      message: `${result.count} report(s) updated`,
      data: { modifiedCount: result.count },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to bulk-update community reports",
    });
  }
};

/**
 * Process refund for a booking
 * POST /api/admin/refunds/:bookingId
 */
export const processRefund = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;
    const { refundType, reason, refundPercentage: customPercentage } =
      req.body as {
        refundType: "FULL" | "PARTIAL";
        reason: string;
        refundPercentage?: number;
      };

    if (!refundType || !reason?.trim()) {
      res.status(400).json({
        success: false,
        message: "refundType and reason are required",
      });
      return;
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
    const result = await processBookingRefund(
      bookingId,
      refundPercentage,
      reason.trim(),
    );

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
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 500;

    res.status(statusCode).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to process refund",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};

/**
 * List bookings with refunds
 * GET /api/admin/refunds?refundStatus=PENDING&page=1&limit=20
 */
export const listRefunds = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const refundStatus = req.query.refundStatus as string;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // `{ $exists: true, $ne: null }` on an optional column -> `{ not: null }`.
    const where: any = {
      refundStatus: { not: null },
    };

    if (refundStatus) {
      where.refundStatus = refundStatus;
    }

    const [bookings, total, statsResult] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
      // Mongo aggregate($group by refundStatus, $sum refundAmount) -> groupBy.
      prisma.booking.groupBy({
        by: ["refundStatus"],
        where: { refundStatus: { not: null } },
        _count: { _all: true },
        _sum: { refundAmount: true },
      }),
    ]);

    // Populate the booking user (String FK) for the response.
    const userIds = [...new Set(bookings.map((booking) => booking.userId))];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, phone: true },
        })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    const stats = {
      pendingCount: 0,
      completedCount: 0,
      failedCount: 0,
      totalAmount: 0,
    };

    statsResult.forEach((s) => {
      const count = s._count._all;
      if (s.refundStatus === "PENDING") stats.pendingCount = count;
      else if (s.refundStatus === "PROCESSED") stats.completedCount = count;
      else if (s.refundStatus === "REJECTED") stats.failedCount = count;

      // Sum the amounts (in rupees)
      stats.totalAmount += s._sum.refundAmount || 0;
    });

    const formattedRefunds = bookings.map((booking) => {
      const player = usersById.get(booking.userId) || null;
      return {
        id: booking.id.toString(),
        bookingId: booking.id.toString(),
        playerId: player?.id?.toString() || "",
        playerName: player?.name || "Unknown",
        playerEmail: player?.email || "",
        amount: booking.refundAmount || 0,
        originalPaymentMethod: "ONLINE",
        status:
          booking.refundStatus === "PROCESSED"
            ? "COMPLETED"
            : booking.refundStatus === "REJECTED"
              ? "FAILED"
              : "PENDING",
        requestedAt: booking.updatedAt || booking.createdAt,
      };
    });

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
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch refund bookings",
    });
  }
};

/**
 * Get PhonePe refund status for a booking
 * GET /api/admin/refunds/:bookingId/status
 */
export const getRefundStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const bookingId = (req.params as Record<string, unknown>)
      .bookingId as string;

    if (!bookingId) {
      res.status(400).json({
        success: false,
        message: "bookingId is required",
      });
      return;
    }

    const status = await getBookingPhonePeRefundStatus(bookingId);

    res.status(200).json({
      success: true,
      message: "Refund status retrieved successfully",
      data: status,
    });
  } catch (error) {
    const statusCode = isPhonePeGatewayError(error) ? error.statusCode : 500;

    res.status(statusCode).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch refund status",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
    });
  }
};

/**
 * List all disputes
 * GET /api/admin/disputes
 */
export const listDisputes = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const disputes = await prisma.dispute.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Populate bookingId -> Booking (with nested venueId -> Venue name) and
    // userId -> User, all via String FKs joined in code.
    const bookingIds = [
      ...new Set(disputes.map((dispute) => dispute.bookingId)),
    ];
    const userIds = [
      ...new Set(
        disputes
          .map((dispute) => dispute.userId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const bookings = bookingIds.length
      ? await prisma.booking.findMany({ where: { id: { in: bookingIds } } })
      : [];
    const bookingsById = new Map(
      bookings.map((booking) => [booking.id, booking]),
    );

    const venueIds = [
      ...new Set(
        bookings
          .map((booking) => booking.venueId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [venues, users] = await Promise.all([
      venueIds.length
        ? prisma.venue.findMany({
            where: { id: { in: venueIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true, phone: true },
          })
        : Promise.resolve([]),
    ]);
    const venuesById = new Map(venues.map((venue) => [venue.id, venue]));
    const usersById = new Map(users.map((user) => [user.id, user]));

    const data = disputes.map((dispute) => {
      const booking = bookingsById.get(dispute.bookingId) || null;
      const bookingPopulated = booking
        ? {
            ...booking,
            venueId: booking.venueId
              ? venuesById.get(booking.venueId) ?? booking.venueId
              : booking.venueId,
          }
        : dispute.bookingId;
      const user = dispute.userId
        ? usersById.get(dispute.userId) ?? dispute.userId
        : dispute.userId;

      return {
        ...dispute,
        bookingId: bookingPopulated,
        userId: user,
      };
    });

    res.status(200).json({
      success: true,
      message: "Disputes retrieved successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch disputes",
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
    const { disputeType, resolution, evidence, reason } = req.body as {
      disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
      resolution: "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND";
      evidence?: string;
      reason?: string;
    };

    // Postgres ids are cuids — presence check replaces ObjectId.isValid().
    if (!bookingId) {
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

    const validDisputeTypes = [
      "NO_SHOW",
      "POOR_QUALITY",
      "PAYMENT_ISSUE",
      "OTHER",
    ];
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
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });
      if (booking?.userId) {
        const disputeUser = await prisma.user.findUnique({
          where: { id: booking.userId },
          select: { name: true, email: true },
        });
        if (disputeUser?.email) {
          sendDisputeStatusEmail({
            name: disputeUser.name,
            email: disputeUser.email,
            disputeType,
            status: "RESOLVED",
            bookingId,
            resolution,
            refundAmount: refundResult?.refundAmount,
          }).catch((error) =>
            console.error("Failed to send dispute email:", error),
          );
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
      console.error(
        "[handleDispute] Failed to send dispute notification:",
        notifError,
      );
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
      message:
        error instanceof Error ? error.message : "Failed to handle dispute",
      ...(isPhonePeGatewayError(error)
        ? { data: { code: error.code, retryable: error.retryable } }
        : {}),
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
      const user = await prisma.user.findUnique({
        where: { id: extractUserId(coach.userId) },
      });
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "VERIFIED",
        });
      }

      // Send in-app notification
      if (user?.id) {
        NotificationService.send({
          userId: user.id.toString(),
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

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "coach.verify",
      targetType: "Coach",
      targetId: coachId,
    });

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
      const user = await prisma.user.findUnique({
        where: { id: extractUserId(coach.userId) },
      });
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "REJECTED",
          notes: reason,
        });
      }

      // Send in-app notification
      if (user?.id) {
        NotificationService.send({
          userId: user.id.toString(),
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

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "coach.reject",
      targetType: "Coach",
      targetId: coachId,
      metadata: { reason },
    });

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
      const user = await prisma.user.findUnique({
        where: { id: extractUserId(coach.userId) },
      });
      if (user?.email) {
        await sendCoachVerificationStatusEmail({
          name: user.name,
          email: user.email,
          status: "REVIEW",
          ...(notes ? { notes } : {}),
        });
      }

      // Send in-app notification
      if (user?.id) {
        NotificationService.send({
          userId: user.id.toString(),
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
    const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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

    const user = await prisma.user.findUnique({
      where: { id: extractUserId(coach.userId) },
      select: { id: true, name: true, email: true },
    });
    if (!user?.id) {
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

    await prisma.coach.update({
      where: { id: coachId },
      data: { lastVerificationReminderAt: new Date() },
    });

    NotificationService.send({
      userId: user.id.toString(),
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

/**
 * Create venue directly from admin
 * POST /api/admin/venues/create
 */
export const createVenueAdminHandler = async (
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

    const {
      ownerName,
      ownerEmail,
      ownerPhone,
      name,
      address,
      sports,
      pricePerHour,
      sportPricing,
      amenities,
      description,
      location,
      openingHours,
      allowExternalCoaches,
      approvalStatus,
    } = req.body;

    const adminAccount = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: { name: true, email: true },
    });

    const defaultOpeningHours: Record<
      string,
      { isOpen: boolean; openTime: string; closeTime: string }
    > = openingHours || {
      monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
      sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
    };

    // Normalized children: sportPricing map -> rows, openingHours obj -> rows.
    const sportPricingRows = Object.entries(
      (sportPricing as Record<string, number>) || {},
    ).map(([sport, price]) => ({ sport, price: Number(price) }));

    const openingHourRows = Object.entries(defaultOpeningHours).map(
      ([day, value]) => ({
        day,
        isOpen: value?.isOpen ?? true,
        openTime: value?.openTime ?? "09:00",
        closeTime: value?.closeTime ?? "21:00",
      }),
    );

    // location GeoJSON Point -> lng/lat scalar columns.
    const coords: number[] | undefined = location?.coordinates;
    const lng = Array.isArray(coords) ? coords[0] : undefined;
    const lat = Array.isArray(coords) ? coords[1] : undefined;

    // TODO(prisma): the legacy Venue carried a `createdBy` field; the Postgres
    // schema has no such column, so it is dropped here. Add it to schema.prisma
    // (+ migration) if admin attribution on venues must be preserved.
    const venue = await prisma.venue.create({
      data: {
        ownerName: ownerName || adminAccount?.name || "Admin Venue",
        ownerEmail:
          ownerEmail ||
          adminAccount?.email ||
          req.user.email ||
          "admin@powersport.local",
        ownerPhone: ownerPhone || req.user.id,
        name,
        address,
        sports,
        pricePerHour,
        amenities: amenities || [],
        description: description || "",
        allowExternalCoaches: allowExternalCoaches !== false,
        approvalStatus: (approvalStatus || "APPROVED") as VenueApprovalStatus,
        ...(lng != null ? { lng } : {}),
        ...(lat != null ? { lat } : {}),
        sportPricing: { create: sportPricingRows },
        openingHours: { create: openingHourRows },
      },
      include: { sportPricing: true, openingHours: true },
    });

    res.status(201).json({
      success: true,
      message: "Venue created successfully",
      data: venue,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create venue",
    });
  }
};

/**
 * Update venue directly from admin
 * PUT /api/admin/venues/:venueId
 */
export const updateVenueAdminHandler = async (
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

    const venueId = (req.params as Record<string, unknown>).venueId as string;

    const venue = await prisma.venue.findUnique({ where: { id: venueId } });

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    const updatePayload = { ...req.body } as Record<string, unknown>;
    const convertExistingUser = updatePayload.convertExistingUser === true;
    delete updatePayload.convertExistingUser;
    // Never allow these to be mass-assigned from the request body — ownerId is
    // resolved by this handler's provisioning logic; rating/reviews are derived.
    for (const f of ["_id", "rating", "reviewCount", "totalReviews"]) {
      delete updatePayload[f];
    }

    const nextApprovalStatus =
      typeof updatePayload.approvalStatus === "string"
        ? (updatePayload.approvalStatus as string)
        : venue.approvalStatus;

    let ownerUser: string | null = null;
    let tempPassword: string | null = null;
    let createdUser = false;

    if (nextApprovalStatus === "APPROVED" && !venue.ownerId) {
      const ownerEmailRaw =
        (updatePayload.ownerEmail as string | undefined) || venue.ownerEmail;
      const ownerPhoneRaw =
        (updatePayload.ownerPhone as string | undefined) || venue.ownerPhone;

      const ownerEmail = ownerEmailRaw?.trim().toLowerCase() || "";
      const ownerPhone = ownerPhoneRaw?.trim() || "";

      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: ownerEmail }, { phone: ownerPhone }] },
      });

      if (existingUser) {
        if (existingUser.role === "VenueLister") {
          ownerUser = existingUser.id;
        } else if (existingUser.role === "Player") {
          if (!convertExistingUser) {
            res.status(409).json({
              success: false,
              message:
                "User already exists as PLAYER. Convert this account to VENUE_LISTER to continue.",
              requiresConversion: true,
              existingRole: existingUser.role,
              targetRole: "VenueLister",
              existingUser: buildUserSummary(existingUser),
            });
            return;
          }

          await prisma.user.update({
            where: { id: existingUser.id },
            data: { role: "VenueLister" },
          });
          ownerUser = existingUser.id;
        } else {
          res.status(409).json({
            success: false,
            message:
              "An account already exists with a different role. Venue lister accounts must be separate.",
            requiresSeparateAccount: true,
            existingRole: existingUser.role,
            targetRole: "VenueLister",
            existingUser: buildUserSummary(existingUser),
          });
          return;
        }
      } else {
        tempPassword = generateTempPassword(12);

        const ownerNameRaw =
          (updatePayload.ownerName as string | undefined) || venue.ownerName;
        const ownerName = ownerNameRaw?.trim() || "Venue Owner";

        const savedUser = await prisma.user.create({
          data: {
            name: ownerName,
            email: ownerEmail,
            phone: ownerPhone,
            // Was hashed by the User pre-save hook in Mongo; hash explicitly now.
            password: await hashTempPassword(tempPassword),
            role: "VenueLister",
          },
        });
        ownerUser = savedUser.id;
        createdUser = true;
      }

      updatePayload.ownerId = ownerUser as unknown as string;
      updatePayload.approvalStatus = "APPROVED";
    }

    // TODO(prisma): the legacy handler mass-assigned the whole request body to
    // Venue.findByIdAndUpdate. With Prisma, the normalized children
    // (sportPricing / openingHours / sportImages) are separate tables and can
    // no longer be set inline — they are stripped here and must be written via
    // nested upserts if the admin UI sends them. `location` GeoJSON is mapped
    // to lng/lat; remaining scalar columns pass through.
    const {
      sportPricing: _sportPricing,
      openingHours: _openingHours,
      sportImages: _sportImages,
      location: locationUpdate,
      ...venueScalarUpdates
    } = updatePayload;

    if (
      locationUpdate &&
      typeof locationUpdate === "object" &&
      Array.isArray((locationUpdate as { coordinates?: number[] }).coordinates)
    ) {
      const coords = (locationUpdate as { coordinates: number[] }).coordinates;
      venueScalarUpdates.lng = coords[0];
      venueScalarUpdates.lat = coords[1];
    }

    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: venueScalarUpdates as any,
    });

    if (!updatedVenue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    if (createdUser && tempPassword) {
      try {
        await sendVenueAdminCredentialsEmail({
          name: updatedVenue.ownerName,
          email: updatedVenue.ownerEmail,
          password: tempPassword,
          loginUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
        });
      } catch (emailError) {
        console.error("Failed to send venue credentials email:", emailError);
      }
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action:
        updatedVenue.approvalStatus !== venue.approvalStatus
          ? `venue.approvalStatus.${updatedVenue.approvalStatus.toLowerCase()}`
          : "venue.update",
      targetType: "Venue",
      targetId: venueId,
      metadata: { approvalStatus: updatedVenue.approvalStatus },
    });

    res.status(200).json({
      success: true,
      message: "Venue updated successfully",
      data: updatedVenue,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update venue",
    });
  }
};

/**
 * Create coach directly from admin
 * POST /api/admin/coaches/create
 */
export const createCoachAdminHandler = async (
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

    const {
      firstName,
      lastName,
      email,
      phone,
      profilePhotoUrl,
      profilePhotoKey,
      bio,
      sports,
      hourlyRate,
      sportPricing,
      serviceMode,
      baseLocation,
      serviceRadiusKm,
      travelBufferTime,
      venueId,
      ownVenueDetails,
      verificationStatus,
      convertExistingUser,
    } = req.body;

    const normalizedEmail = typeof email === "string" ? email.trim() : "";
    const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail.toLowerCase() },
          { phone: normalizedPhone },
        ],
      },
    });
    let tempPassword: string | undefined;
    let createdUser = false;

    if (user) {
      if (user.role === "Coach") {
        const existingCoach = await prisma.coach.findUnique({
          where: { userId: user.id },
        });
        if (existingCoach) {
          res.status(409).json({
            success: false,
            message: "Coach profile already exists for this account",
            existingRole: user.role,
            targetRole: "Coach",
            existingUser: buildUserSummary(user),
          });
          return;
        }
      } else if (user.role === "Player") {
        if (!convertExistingUser) {
          res.status(409).json({
            success: false,
            message:
              "User already exists as PLAYER. Convert this account to COACH to continue.",
            requiresConversion: true,
            existingRole: user.role,
            targetRole: "Coach",
            existingUser: buildUserSummary(user),
          });
          return;
        }

        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: "Coach" },
        });
      } else {
        res.status(409).json({
          success: false,
          message:
            "An account already exists with a different role. Coach accounts must be separate.",
          requiresSeparateAccount: true,
          existingRole: user.role,
          targetRole: "Coach",
          existingUser: buildUserSummary(user),
        });
        return;
      }
    } else {
      tempPassword = generateTempPassword(12);
      user = await prisma.user.create({
        data: {
          name: `${firstName} ${lastName}`,
          email: normalizedEmail,
          phone: normalizedPhone,
          role: "Coach",
          isActive: true,
          // Was hashed by the User pre-save hook in Mongo; hash explicitly now.
          password: await hashTempPassword(tempPassword),
        },
      });
      createdUser = true;
    }

    if (profilePhotoUrl || profilePhotoKey) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          photoUrl: profilePhotoUrl || user.photoUrl,
          photoS3Key: profilePhotoKey || user.photoS3Key,
        },
      });
    }

    // ownVenueDetails (embedded in Mongo) -> CoachOwnVenue child columns.
    const ownVenueCoords: number[] | undefined =
      ownVenueDetails?.location?.coordinates || ownVenueDetails?.coordinates;
    const normalizedOwnVenue =
      ownVenueDetails && typeof ownVenueDetails === "object"
        ? {
            name: ownVenueDetails.name,
            address: ownVenueDetails.address,
            description: ownVenueDetails.description || "",
            openingHours: ownVenueDetails.openingHours || "",
            images: ownVenueDetails.images || [],
            imageS3Keys: ownVenueDetails.imageS3Keys || [],
            lng: (Array.isArray(ownVenueCoords) ? ownVenueCoords[0] : undefined) ?? null,
            lat: (Array.isArray(ownVenueCoords) ? ownVenueCoords[1] : undefined) ?? null,
            sports,
            amenities: [],
            pricePerHour: hourlyRate,
          }
        : undefined;

    // baseLocation GeoJSON -> baseLng/baseLat scalar columns.
    const baseCoords: number[] | undefined = baseLocation?.coordinates;
    const baseLng = Array.isArray(baseCoords) ? baseCoords[0] : undefined;
    const baseLat = Array.isArray(baseCoords) ? baseCoords[1] : undefined;

    // sportPricing map -> CoachSportPricing rows.
    const sportPricingRows = Object.entries(
      (sportPricing as Record<string, number>) || {},
    ).map(([sport, price]) => ({ sport, price: Number(price) }));

    // TODO(prisma): the legacy Coach carried `venueId` and `createdBy` fields;
    // the Postgres Coach model has neither column, so they are dropped here.
    // Add them to schema.prisma (+ migration) if that linkage/attribution must
    // be preserved. (`venueId` from the request body is intentionally unused.)
    void venueId;

    const coach = await prisma.coach.create({
      data: {
        userId: user.id,
        bio,
        sports,
        hourlyRate,
        serviceMode: serviceMode || "FREELANCE",
        ...(serviceRadiusKm != null ? { serviceRadiusKm } : {}),
        ...(travelBufferTime != null ? { travelBufferTime } : {}),
        verificationStatus: verificationStatus || "VERIFIED",
        isVerified: (verificationStatus || "VERIFIED") === "VERIFIED",
        ...(baseLng != null ? { baseLng } : {}),
        ...(baseLat != null ? { baseLat } : {}),
        ...(sportPricingRows.length
          ? { sportPricing: { create: sportPricingRows } }
          : {}),
        ...(normalizedOwnVenue
          ? { ownVenue: { create: normalizedOwnVenue } }
          : {}),
      },
      include: { sportPricing: true, ownVenue: true },
    });

    if (createdUser && tempPassword) {
      try {
        await sendCoachAdminCredentialsEmail({
          name: user.name,
          email: user.email,
          password: tempPassword,
          loginUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`,
        });
      } catch (emailError) {
        console.error("Failed to send coach credentials email:", emailError);
      }
    }

    // Send in-app notification
    try {
      NotificationService.send({
        userId: user.id.toString(),
        type: "COACH_VERIFICATION_VERIFIED",
        title: "Welcome to PowerMySport",
        message:
          "Your coach account has been created and verified successfully.",
        data: {
          coachId: coach.id.toString(),
          createdAt: new Date().toISOString(),
        },
      }).catch((err: Error) =>
        console.error("Failed to send coach creation notification:", err),
      );
    } catch (notificationError) {
      console.error("Failed to send in-app notification:", notificationError);
    }

    res.status(201).json({
      success: true,
      message: "Coach created successfully",
      data: { coach, user },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create coach",
    });
  }
};
