import { Router } from "express";
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
} from "../controllers/payoutController";
import { authMiddleware, venueListerMiddleware } from "../../middleware/auth";

const router = Router();

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
router.put("/coach/my-payout-method", authMiddleware, upsertCoachPayoutMethod);

/**
 * DELETE /api/payouts/coach/my-payout-method/:methodId
 * Remove a specific coach's payout method (or all if no ID)
 */
router.delete(
  "/coach/my-payout-method",
  authMiddleware,
  deleteCoachPayoutMethod,
);
router.delete(
  "/coach/my-payout-method/:methodId",
  authMiddleware,
  deleteCoachPayoutMethod,
);

/**
 * PUT /api/payouts/coach/my-payout-method/:methodId/set-default
 * Set a specific payout method as default
 */
router.put(
  "/coach/my-payout-method/:methodId/set-default",
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
  authMiddleware,
  venueListerMiddleware,
  deleteVenuePayoutMethod,
);
router.delete(
  "/venue/my-payout-method/:methodId",
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
  authMiddleware,
  venueListerMiddleware,
  setVenueDefaultPayoutMethod,
);

export default router;
