import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  createAdminAccount,
  getAdminBookings,
  getAdminProfile,
  handleDispute,
  listAdmins,
  processRefund,
} from "../controllers/adminController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";

const router = Router();

// Public routes
router.post("/login", adminLogin);

// Protected routes (require admin authentication)
router.post("/logout", authMiddleware, adminLogout);
router.get("/profile", authMiddleware, getAdminProfile);

// Admin booking management
router.get("/bookings", authMiddleware, adminMiddleware, getAdminBookings);

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
