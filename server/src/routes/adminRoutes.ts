import { Router } from "express";
import {
  createCoachPlanAdminHandler,
  listCoachPlansAdminHandler,
  listCoachSubscriptionsAdminHandler,
  listOverrideRequestsAdminHandler,
  reviewOverrideRequestAdminHandler,
  updateCoachPlanAdminHandler,
} from "../controllers/coachSubscriptionController";
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
  listUsersForSafety,
  markCoachVerificationForReview,
  notifyCoachVerificationPending,
  processRefund,
  rejectCoachVerification,
  reviewCommunityReport,
  listCommunityReports,
  updateUserSafetyStatus,
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
  adminCreateCoachPlanSchema,
  adminCreateSchema,
  adminReviewCoachOverrideSchema,
  adminLoginSchema,
  adminUpdateCoachPlanSchema,
  communityModerationActionSchema,
  promoCreateSchema,
} from "../middleware/schemas";
import {
  createPromoCodeHandler,
  deactivatePromoCodeHandler,
  listPromoCodesHandler,
  promoCodeStatsHandler,
} from "../controllers/promoCodeController";
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
router.post(
  "/coaches/:coachId/notify",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:verify"),
  notifyCoachVerificationPending,
);

// Coach subscription plan management
router.get(
  "/coach-plans",
  authMiddleware,
  adminMiddleware,
  requirePermission("coach-subscriptions:view"),
  listCoachPlansAdminHandler,
);
router.post(
  "/coach-plans",
  authMiddleware,
  adminMiddleware,
  requirePermission("coach-subscriptions:create"),
  validateRequest(adminCreateCoachPlanSchema),
  createCoachPlanAdminHandler,
);
router.patch(
  "/coach-plans/:planId",
  authMiddleware,
  adminMiddleware,
  requirePermission("coach-subscriptions:manage"),
  validateRequest(adminUpdateCoachPlanSchema),
  updateCoachPlanAdminHandler,
);

// Coach subscriptions operations
router.get(
  "/coach-subscriptions",
  authMiddleware,
  adminMiddleware,
  requirePermission("coach-subscriptions:view"),
  listCoachSubscriptionsAdminHandler,
);
router.get(
  "/coach-subscription-overrides",
  authMiddleware,
  adminMiddleware,
  requirePermission("coach-subscriptions:override-review"),
  listOverrideRequestsAdminHandler,
);
router.patch(
  "/coach-subscription-overrides/:requestId/review",
  authMiddleware,
  adminMiddleware,
  requirePermission("coach-subscriptions:override-review"),
  validateRequest(adminReviewCoachOverrideSchema),
  reviewOverrideRequestAdminHandler,
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

router.get(
  "/users/safety",
  authMiddleware,
  adminMiddleware,
  requirePermission("users:view"),
  listUsersForSafety,
);
router.patch(
  "/users/:userId/safety",
  authMiddleware,
  adminMiddleware,
  requirePermission("users:manage"),
  updateUserSafetyStatus,
);

router.get(
  "/community/reports",
  authMiddleware,
  adminMiddleware,
  requirePermission("users:view"),
  listCommunityReports,
);
router.patch(
  "/community/reports/:reportId",
  authMiddleware,
  adminMiddleware,
  requirePermission("users:manage"),
  validateRequest(communityModerationActionSchema),
  reviewCommunityReport,
);

// Promo code management
router.get(
  "/promo-codes",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:view"),
  listPromoCodesHandler,
);
router.post(
  "/promo-codes",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:manage"),
  validateRequest(promoCreateSchema),
  createPromoCodeHandler,
);
router.patch(
  "/promo-codes/:codeId/deactivate",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:manage"),
  deactivatePromoCodeHandler,
);
router.get(
  "/promo-codes/:codeId/stats",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:view"),
  promoCodeStatsHandler,
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
