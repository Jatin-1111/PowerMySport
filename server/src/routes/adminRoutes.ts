import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  approveCoachVerification,
  changeAdminPasswordHandler,
  createAdminAccount,
  getCoachVerificationDetails,
  getAdminProfile,
  handleDispute,
  listAdmins,
  listCoachVerifications,
  markCoachVerificationForReview,
  processRefund,
  rejectCoachVerification,
  getRoleTemplates,
  updateAdminPermissionsHandler,
  updateAdminRoleHandler,
} from "../controllers/adminController";
import {
  adminMiddleware,
  authMiddleware,
  superAdminMiddleware,
  requirePermission,
} from "../middleware/auth";
import {
  adminChangePasswordSchema,
  adminCreateSchema,
  adminLoginSchema,
} from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

// Public routes
router.post("/login", validateRequest(adminLoginSchema), adminLogin);

// Protected routes (require admin authentication)
router.post("/logout", authMiddleware, adminLogout);
router.get("/profile", authMiddleware, getAdminProfile);
router.post(
  "/change-password",
  authMiddleware,
  adminMiddleware,
  validateRequest(adminChangePasswordSchema),
  changeAdminPasswordHandler,
);

// Coach verification management
router.get(
  "/coaches/verification",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:view"),
  listCoachVerifications,
);
router.get(
  "/coaches/:coachId",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:view"),
  getCoachVerificationDetails,
);
router.post(
  "/coaches/:coachId/verify",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:verify"),
  approveCoachVerification,
);
router.post(
  "/coaches/:coachId/reject",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:verify"),
  rejectCoachVerification,
);
router.post(
  "/coaches/:coachId/mark-review",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:verify"),
  markCoachVerificationForReview,
);

// Refund & dispute handling
router.post(
  "/refunds/:bookingId",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:refund"),
  processRefund,
);
router.post(
  "/disputes/:bookingId",
  authMiddleware,
  adminMiddleware,
  requirePermission("disputes:resolve"),
  handleDispute,
);

// Admin management routes (System Admin only)
router.post(
  "/create",
  authMiddleware,
  adminMiddleware,
  superAdminMiddleware,
  validateRequest(adminCreateSchema),
  createAdminAccount,
);
router.get(
  "/list",
  authMiddleware,
  adminMiddleware,
  requirePermission("admins:view"),
  listAdmins,
);
router.get(
  "/role-templates",
  authMiddleware,
  adminMiddleware,
  getRoleTemplates,
);
router.put(
  "/:adminId/permissions",
  authMiddleware,
  adminMiddleware,
  requirePermission("admins:manage"),
  updateAdminPermissionsHandler,
);
router.put(
  "/:adminId/role",
  authMiddleware,
  adminMiddleware,
  requirePermission("admins:manage"),
  updateAdminRoleHandler,
);

export default router;
