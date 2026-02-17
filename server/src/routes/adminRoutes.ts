import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  approveCoachVerification,
  createAdminAccount,
  getAdminBookings,
  getAdminProfile,
  handleDispute,
  listAdmins,
  listCoachVerifications,
  markCoachVerificationForReview,
  processRefund,
  rejectCoachVerification,
} from "../controllers/adminController";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

const router = Router();

// Public routes
router.post("/login", adminLogin);

// Protected routes (require admin authentication)
router.post("/logout", authMiddleware, adminLogout);
router.get("/profile", authMiddleware, getAdminProfile);

// Admin booking management
router.get("/bookings", authMiddleware, adminMiddleware, getAdminBookings);

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
router.post("/create", authMiddleware, adminMiddleware, createAdminAccount);
router.get("/list", authMiddleware, adminMiddleware, listAdmins);

export default router;
