import { Router } from "express";
import {
  forgotPassword,
  getProfile,
  googleAuth,
  login,
  logout,
  register,
  resetPasswordHandler,
} from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";
import { loginSchema, registerSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

router.post("/register", validateRequest(registerSchema), register);
router.post("/login", validateRequest(loginSchema), login);
router.post("/logout", authMiddleware, logout);
router.get("/profile", authMiddleware, getProfile);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPasswordHandler);
router.post("/google", googleAuth);

export default router;
