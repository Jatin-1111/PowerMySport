import { Router } from "express";
import {
  createNewCoach,
  deleteCoachProfile,
  getCoach,
  getCoachAvailability,
  getCoachVerificationUploadUrlHandler,
  getMyCoachProfile,
  submitCoachVerificationHandler,
  updateCoachProfile,
} from "../controllers/coachController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Create coach profile (requires authentication and COACH role)
router.post("/", authMiddleware, createNewCoach);

// Get current user's coach profile
router.get("/my-profile", authMiddleware, getMyCoachProfile);

// Get upload URL for verification documents
router.post(
  "/verification/upload-url",
  authMiddleware,
  getCoachVerificationUploadUrlHandler,
);

// Submit verification documents
router.post("/verification", authMiddleware, submitCoachVerificationHandler);

// Check coach availability
router.get("/availability/:coachId", getCoachAvailability);

// Get coach by ID (public)
router.get("/:coachId", getCoach);

// Update coach profile
router.put("/:coachId", authMiddleware, updateCoachProfile);

// Delete coach profile
router.delete("/:coachId", authMiddleware, deleteCoachProfile);

export default router;
