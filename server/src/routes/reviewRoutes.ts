import { Router } from "express";
import {
  createReview,
  getCoachReviews,
  getModerationQueue,
  getReviewEligibility,
  getVenueReviews,
  moderateReview,
} from "../controllers/reviewController";
import {
  adminMiddleware,
  authMiddleware,
  requirePermission,
} from "../middleware/auth";
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

router.get(
  "/moderation/queue",
  authMiddleware,
  adminMiddleware,
  requirePermission("reviews:view"),
  getModerationQueue,
);

router.patch(
  "/:reviewId/moderate",
  authMiddleware,
  adminMiddleware,
  requirePermission("reviews:manage"),
  moderateReview,
);

export default router;
