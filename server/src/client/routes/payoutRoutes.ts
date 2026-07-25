import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getCoachPayoutMethod,
  getCoachPayoutMethods,
  upsertCoachPayoutMethod,
  deleteCoachPayoutMethod,
  setCoachDefaultPayoutMethod,
  getVenuePayoutMethod,
  upsertVenuePayoutMethod,
  deleteVenuePayoutMethod,
  setVenueDefaultPayoutMethod,
  getExpertPayoutMethod,
  getExpertPayoutMethods,
  upsertExpertPayoutMethod,
  deleteExpertPayoutMethod,
  setExpertDefaultPayoutMethod,
} from "../controllers/payoutController";
import { authMiddleware, venueListerMiddleware } from "../../middleware/auth";

const router = Router();

// This whole file previously had no rate limiting at all — payout method
// mutations write real bank/UPI account details, so throttle them.
const payoutMutationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15, // max 15 payout-method writes per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please wait a moment and try again.",
  },
});

// ============================================
// COACH PAYOUT ROUTES
// ============================================

/**
 * GET /api/payouts/coach/my-payout-method
 * Get current coach's primary payout method
 */
router.get("/coach/my-payout-method", authMiddleware, getCoachPayoutMethod);

/**
 * GET /api/payouts/coach/my-payout-methods
 * Get all of coach's payout methods
 */
router.get("/coach/my-payout-methods", authMiddleware, getCoachPayoutMethods);

/**
 * PUT /api/payouts/coach/my-payout-method
 * Save / update coach's payout method (add new or update existing)
 */
router.put(
  "/coach/my-payout-method",
  payoutMutationRateLimiter,
  authMiddleware,
  upsertCoachPayoutMethod,
);

/**
 * DELETE /api/payouts/coach/my-payout-method/:methodId
 * Remove a specific coach's payout method (or all if no ID)
 */
router.delete(
  "/coach/my-payout-method",
  payoutMutationRateLimiter,
  authMiddleware,
  deleteCoachPayoutMethod,
);
router.delete(
  "/coach/my-payout-method/:methodId",
  payoutMutationRateLimiter,
  authMiddleware,
  deleteCoachPayoutMethod,
);

/**
 * PUT /api/payouts/coach/my-payout-method/:methodId/set-default
 * Set a specific payout method as default
 */
router.put(
  "/coach/my-payout-method/:methodId/set-default",
  payoutMutationRateLimiter,
  authMiddleware,
  setCoachDefaultPayoutMethod,
);

// ============================================
// VENUE OWNER PAYOUT ROUTES
// ============================================

/**
 * GET /api/payouts/venue/my-payout-method
 * Get venue owner's payout method
 */
router.get(
  "/venue/my-payout-method",
  authMiddleware,
  venueListerMiddleware,
  getVenuePayoutMethod,
);

/**
 * PUT /api/payouts/venue/my-payout-method
 * Save / update venue owner's payout method
 */
router.put(
  "/venue/my-payout-method",
  payoutMutationRateLimiter,
  authMiddleware,
  venueListerMiddleware,
  upsertVenuePayoutMethod,
);

/**
 * DELETE /api/payouts/venue/my-payout-method/:methodId
 * Remove a specific venue owner's payout method (or all if no ID)
 */
router.delete(
  "/venue/my-payout-method",
  payoutMutationRateLimiter,
  authMiddleware,
  venueListerMiddleware,
  deleteVenuePayoutMethod,
);
router.delete(
  "/venue/my-payout-method/:methodId",
  payoutMutationRateLimiter,
  authMiddleware,
  venueListerMiddleware,
  deleteVenuePayoutMethod,
);

/**
 * PUT /api/payouts/venue/my-payout-method/:methodId/set-default
 * Set a specific payout method as default for all venues
 */
router.put(
  "/venue/my-payout-method/:methodId/set-default",
  payoutMutationRateLimiter,
  authMiddleware,
  venueListerMiddleware,
  setVenueDefaultPayoutMethod,
);

// ============================================
// EXPERT PAYOUT ROUTES
// ============================================

/**
 * GET /api/payouts/expert/my-payout-method
 * Get current expert's primary payout method
 */
router.get("/expert/my-payout-method", authMiddleware, getExpertPayoutMethod);

/**
 * GET /api/payouts/expert/my-payout-methods
 * Get all of the expert's payout methods
 */
router.get("/expert/my-payout-methods", authMiddleware, getExpertPayoutMethods);

/**
 * PUT /api/payouts/expert/my-payout-method
 * Save / update the expert's payout method (add new or update existing)
 */
router.put(
  "/expert/my-payout-method",
  payoutMutationRateLimiter,
  authMiddleware,
  upsertExpertPayoutMethod,
);

/**
 * DELETE /api/payouts/expert/my-payout-method/:methodId
 * Remove a specific expert payout method (or all if no ID)
 */
router.delete(
  "/expert/my-payout-method",
  payoutMutationRateLimiter,
  authMiddleware,
  deleteExpertPayoutMethod,
);
router.delete(
  "/expert/my-payout-method/:methodId",
  payoutMutationRateLimiter,
  authMiddleware,
  deleteExpertPayoutMethod,
);

/**
 * PUT /api/payouts/expert/my-payout-method/:methodId/set-default
 * Set a specific payout method as default
 */
router.put(
  "/expert/my-payout-method/:methodId/set-default",
  payoutMutationRateLimiter,
  authMiddleware,
  setExpertDefaultPayoutMethod,
);

export default router;
