import { Router } from "express";
import {
  createReview,
  getCoachReviews,
  getReviewEligibility,
  getVenueReviews,
} from "../controllers/reviewController";
import { authMiddleware } from "../middleware/auth";
import { createReviewSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

router.get("/venues/:venueId", getVenueReviews);
router.get("/coaches/:coachId", getCoachReviews);
router.get("/eligibility", authMiddleware, getReviewEligibility);
router.post(
  "/",
  authMiddleware,
  validateRequest(createReviewSchema),
  createReview,
);

export default router;
