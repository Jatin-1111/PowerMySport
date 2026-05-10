import { Router } from "express";
import {
  getCoachPayoutMethod,
  upsertCoachPayoutMethod,
  deleteCoachPayoutMethod,
  getVenuePayoutMethod,
  upsertVenuePayoutMethod,
  deleteVenuePayoutMethod,
} from "../controllers/payoutController";
import { authMiddleware, venueListerMiddleware } from "../middleware/auth";

const router = Router();

// ============================================
// COACH PAYOUT ROUTES
// ============================================

/**
 * GET /api/payouts/coach/my-payout-method
 * Get current coach's payout method
 */
router.get("/coach/my-payout-method", authMiddleware, getCoachPayoutMethod);

/**
 * PUT /api/payouts/coach/my-payout-method
 * Save / update coach's payout method
 */
router.put("/coach/my-payout-method", authMiddleware, upsertCoachPayoutMethod);

/**
 * DELETE /api/payouts/coach/my-payout-method
 * Remove coach's payout method
 */
router.delete(
  "/coach/my-payout-method",
  authMiddleware,
  deleteCoachPayoutMethod,
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
  authMiddleware,
  venueListerMiddleware,
  upsertVenuePayoutMethod,
);

/**
 * DELETE /api/payouts/venue/my-payout-method
 * Remove venue owner's payout method
 */
router.delete(
  "/venue/my-payout-method",
  authMiddleware,
  venueListerMiddleware,
  deleteVenuePayoutMethod,
);

export default router;
