import { Router } from "express";
import {
  register,
  login,
  logout,
  getProfile,
} from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { registerSchema, loginSchema } from "../middleware/schemas";

const router = Router();

router.post("/register", validateRequest(registerSchema), register);
router.post("/login", validateRequest(loginSchema), login);
router.post("/logout", authMiddleware, logout);
router.get("/profile", authMiddleware, getProfile);

export default router;
