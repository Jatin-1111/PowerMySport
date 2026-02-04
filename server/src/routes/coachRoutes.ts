import { Router } from "express";
import {
  createNewCoach,
  getCoach,
  getMyCoachProfile,
  updateCoachProfile,
  deleteCoachProfile,
  getCoachAvailability,
} from "../controllers/coachController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Create coach profile (requires authentication and COACH role)
router.post("/", authMiddleware, createNewCoach);

// Get current user's coach profile
router.get("/my-profile", authMiddleware, getMyCoachProfile);

// Get coach by ID (public)
router.get("/:coachId", getCoach);

// Update coach profile
router.put("/:coachId", authMiddleware, updateCoachProfile);

// Delete coach profile
router.delete("/:coachId", authMiddleware, deleteCoachProfile);

// Check coach availability
router.get("/availability/:coachId", getCoachAvailability);

export default router;
