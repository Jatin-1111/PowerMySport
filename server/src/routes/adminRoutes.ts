import { Router } from "express";
import {
  adminLogin,
  adminLogout,
  getAdminProfile,
  createAdminAccount,
  listAdmins,
} from "../controllers/adminController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";

const router = Router();

// Public routes
router.post("/login", adminLogin);

// Protected routes (require admin authentication)
router.post("/logout", authMiddleware, adminLogout);
router.get("/profile", authMiddleware, getAdminProfile);

// Super admin only routes
router.post("/create", authMiddleware, adminMiddleware, createAdminAccount);
router.get("/list", authMiddleware, adminMiddleware, listAdmins);

export default router;
