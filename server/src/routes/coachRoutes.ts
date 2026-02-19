import { Router } from "express";
import {
  createNewCoach,
  deleteCoachProfile,
  getCoach,
  getCoachAvailability,
  saveCoachVerificationStep1Handler,
  saveCoachVerificationStep2Handler,
  getCoachVerificationUploadUrlHandler,
  getMyCoachProfile,
  submitCoachVerificationStep3Handler,
  submitCoachVerificationHandler,
  updateCoachProfile,
} from "../controllers/coachController";
import { authMiddleware } from "../middleware/auth";
import {
  coachVerificationStep1Schema,
  coachVerificationStep2Schema,
  coachVerificationStep3Schema,
} from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

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

// Save verification step 1 (bio)
router.post(
  "/verification/step1",
  authMiddleware,
  validateRequest(coachVerificationStep1Schema),
  saveCoachVerificationStep1Handler,
);

// Save verification step 2 (sports/profile)
router.post(
  "/verification/step2",
  authMiddleware,
  validateRequest(coachVerificationStep2Schema),
  saveCoachVerificationStep2Handler,
);

// Submit verification step 3 (documents)
router.post(
  "/verification/step3",
  authMiddleware,
  validateRequest(coachVerificationStep3Schema),
  submitCoachVerificationStep3Handler,
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
