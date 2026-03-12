import { Router } from "express";
import {
  getPlatformStats,
  getAllUsers,
  getAllVenues,
  getAllBookings,
  getUserRoleSummary,
  getPlayersUsers,
  getCoachUsers,
  getVenueListerUsers,
  getPlayersAnalytics,
  getCoachesAnalytics,
  getVenueListersAnalytics,
  getFinanceReconciliation,
  getFunnelSummary,
  getObservabilityStats,
  trackFunnelEvent,
} from "../controllers/statsController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";
import { funnelEventSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

// Authenticated events (players/coaches/venue-listers/admins)
router.use(authMiddleware);
router.post(
  "/funnel/event",
  validateRequest(funnelEventSchema),
  trackFunnelEvent,
);

// All routes below require admin authentication
router.use(adminMiddleware);

router.get("/platform", getPlatformStats);
router.get("/users/summary", getUserRoleSummary);
router.get("/users/players", getPlayersUsers);
router.get("/users/coaches", getCoachUsers);
router.get("/users/venue-listers", getVenueListerUsers);
router.get("/users/analytics/players", getPlayersAnalytics);
router.get("/users/analytics/coaches", getCoachesAnalytics);
router.get("/users/analytics/venue-listers", getVenueListersAnalytics);
router.get("/users", getAllUsers);
router.get("/venues", getAllVenues);
router.get("/bookings", getAllBookings);
router.get("/funnel/summary", getFunnelSummary);
router.get("/finance/reconciliation", getFinanceReconciliation);
router.get("/observability", getObservabilityStats);

export default router;
