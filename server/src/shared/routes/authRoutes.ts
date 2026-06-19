import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  addDependentHandler,
  confirmProfilePictureUploadHandler,
  deleteDependentHandler,
  forgotPassword,
  getAuthBridge,
  getProfile,
  getProfilePictureUploadUrlHandler,
  googleAuth,
  graduateDependentHandler,
  login,
  logout,
  register,
  resetPasswordHandler,
  updateDependentHandler,
  updateProfileHandler,
  getMyPlayersHandler,
} from "../controller/authController";
import { authMiddleware } from "../../middleware/auth";
import { loginSchema, registerSchema } from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";

const router = Router();

// Max 10 login attempts per 15 minutes per IP — failed attempts only
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

// Max 5 password reset requests per hour per IP
const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset requests. Please try again in 1 hour.",
  },
});

router.post("/register", validateRequest(registerSchema), register);
router.post("/login", loginRateLimiter, validateRequest(loginSchema), login);
router.post("/logout", authMiddleware, logout);
router.get("/profile", authMiddleware, getProfile);
router.get("/bridge", authMiddleware, getAuthBridge);
router.put("/profile", authMiddleware, updateProfileHandler);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password", resetPasswordHandler);
router.post("/google", googleAuth);
router.post("/graduate", authMiddleware, graduateDependentHandler);

// Profile picture endpoints
router.post(
  "/profile-picture/upload-url",
  authMiddleware,
  getProfilePictureUploadUrlHandler,
);
router.post(
  "/profile-picture/confirm",
  authMiddleware,
  confirmProfilePictureUploadHandler,
);

// Dependent management endpoints
router.get("/players", authMiddleware, getMyPlayersHandler);
router.post("/dependents", authMiddleware, addDependentHandler);
router.put("/dependents/:dependentId", authMiddleware, updateDependentHandler);
router.delete(
  "/dependents/:dependentId",
  authMiddleware,
  deleteDependentHandler,
);

export default router;
