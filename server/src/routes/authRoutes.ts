import { Router } from "express";
import {
  addDependentHandler,
  confirmProfilePictureUploadHandler,
  deleteDependentHandler,
  forgotPassword,
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
} from "../controllers/authController";
import { authMiddleware } from "../middleware/auth";
import { loginSchema, registerSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

router.post("/register", validateRequest(registerSchema), register);
router.post("/login", validateRequest(loginSchema), login);
router.post("/logout", authMiddleware, logout);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfileHandler);
router.post("/forgot-password", forgotPassword);
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
router.post("/dependents", authMiddleware, addDependentHandler);
router.put("/dependents/:dependentId", authMiddleware, updateDependentHandler);
router.delete(
  "/dependents/:dependentId",
  authMiddleware,
  deleteDependentHandler,
);

export default router;
