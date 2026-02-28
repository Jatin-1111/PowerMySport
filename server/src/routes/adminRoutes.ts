import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  approveCoachVerification,
  changeAdminPasswordHandler,
  createAdminAccount,
  getAdminProfile,
  handleDispute,
  listAdmins,
  listCoachVerifications,
  markCoachVerificationForReview,
  processRefund,
  rejectCoachVerification,
} from "../controllers/adminController";
import {
  adminMiddleware,
  authMiddleware,
  superAdminMiddleware,
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
  listCoachVerifications,
);
router.post(
  "/coaches/:coachId/verify",
  authMiddleware,
  adminMiddleware,
  approveCoachVerification,
);
router.post(
  "/coaches/:coachId/reject",
  authMiddleware,
  adminMiddleware,
  rejectCoachVerification,
);
router.post(
  "/coaches/:coachId/mark-review",
  authMiddleware,
  adminMiddleware,
  markCoachVerificationForReview,
);

// Refund & dispute handling (stubs - require payment gateway)
router.post(
  "/refunds/:bookingId",
  authMiddleware,
  adminMiddleware,
  processRefund,
);
router.post(
  "/disputes/:bookingId",
  authMiddleware,
  adminMiddleware,
  handleDispute,
);

// Super admin only routes
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
  superAdminMiddleware,
  listAdmins,
);

export default router;
