import { Router } from "express";
import { S3Service } from "../../shared/services/S3Service";
import { listCoachSubscriptionsAdminHandler } from "../../client/controllers/coachSubscriptionController";
import {
  listPendingPayouts,
  markPayoutsAsPaid,
} from "../controllers/adminPayoutController";
import {
  adminLogin,
  adminLogout,
  approveCoachVerification,
  changeAdminPasswordHandler,
  createAdminAccount,
  createCoachAdminHandler,
  createVenueAdminHandler,
  getAdminCoachVerificationUploadUrlHandler,
  updateCoachAdminHandler,
  listCoaches,
  submitCoachVerificationAdminHandler,
  getCoachVerificationDetails,
  getAdminProfile,
  handleDispute,
  listAdmins,
  listCoachVerifications,
  listUsersForSafety,
  markCoachVerificationForReview,
  notifyCoachVerificationPending,
  processRefund,
  getRefundStatus,
  rejectCoachVerification,
  reviewCommunityReport,
  listCommunityReports,
  updateVenueAdminHandler,
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
} from "../../middleware/auth";
import {
  adminChangePasswordSchema,
  adminCreateCoachSchema,
  adminCreateSchema,
  adminCreateVenueSchema,
  adminReviewCoachOverrideSchema,
  adminLoginSchema,
  communityModerationActionSchema,
  promoCreateSchema,
} from "../../middleware/schemas";
import {
  createPromoCodeHandler,
  deactivatePromoCodeHandler,
  listPromoCodesHandler,
  promoCodeStatsHandler,
} from "../../client/controllers/promoCodeController";
import { validateRequest } from "../../middleware/validation";

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

// ===== NEW: Admin venue and coach creation routes =====
router.post(
  "/venues/create",
  authMiddleware,
  adminMiddleware,
  requirePermission("venues:create"),
  validateRequest(adminCreateVenueSchema),
  createVenueAdminHandler,
);

router.put(
  "/venues/:venueId",
  authMiddleware,
  adminMiddleware,
  requirePermission("venues:manage"),
  updateVenueAdminHandler,
);

router.post(
  "/coaches/create",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:create"),
  validateRequest(adminCreateCoachSchema),
  createCoachAdminHandler,
);

router.get(
  "/coaches",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:view"),
  listCoaches,
);

router.post(
  "/coaches/photo-upload-url",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:create"),
  async (req, res) => {
    try {
      const { fileName, contentType } = req.body;

      if (!fileName || !contentType) {
        return res.status(400).json({
          success: false,
          message: "fileName and contentType are required",
        });
      }

      const s3Service = new S3Service();
      const { uploadUrl, downloadUrl, key } =
        await s3Service.generateCoachPhotoUploadUrl(
          fileName,
          contentType,
          "pending",
        );

      return res.json({
        success: true,
        data: {
          uploadUrl,
          downloadUrl,
          key,
        },
      });
    } catch (error) {
      console.error("Photo upload URL generation error:", error);
      return res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to generate upload URL",
      });
    }
  },
);

// Admin: presigned upload URL for coach verification / venue images
router.post(
  "/coaches/:coachId/verification/upload-url",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:create"),
  getAdminCoachVerificationUploadUrlHandler,
);

// Admin: update coach profile partially
router.put(
  "/coaches/:coachId",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:manage"),
  updateCoachAdminHandler,
);

// Admin: submit verification on behalf of coach
router.post(
  "/coaches/:coachId/verification/submit",
  authMiddleware,
  adminMiddleware,
  requirePermission("coaches:verify"),
  submitCoachVerificationAdminHandler,
);

// Admin coach-plans removed — coaches create packages now

// Coach subscriptions operations
router.get(
  "/coach-subscriptions",
  authMiddleware,
  adminMiddleware,
  requirePermission("coach-subscriptions:view"),
  listCoachSubscriptionsAdminHandler,
);
// Coach subscription override admin endpoints removed (deprecated)

// Refund & dispute handling
router.post(
  "/refunds/:bookingId",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:refund"),
  processRefund,
);
router.get(
  "/refunds/:bookingId/status",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:refund"),
  getRefundStatus,
);
router.post(
  "/disputes/:bookingId",
  authMiddleware,
  adminMiddleware,
  requirePermission("disputes:resolve"),
  handleDispute,
);

// Payouts & Settlements
router.get(
  "/payouts/pending",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:view"),
  listPendingPayouts,
);
router.post(
  "/payouts/mark-paid",
  authMiddleware,
  adminMiddleware,
  requirePermission("bookings:refund"), // You could create a 'payouts:manage' permission, but bookings:refund is functionally identical for finance ops
  markPayoutsAsPaid,
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
