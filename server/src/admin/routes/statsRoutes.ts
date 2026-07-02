import { Router } from "express";
import {
  getPublicPlatformStats,
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
  getFunnelTrends,
  getUserGrowthAnalytics,
  getFinanceReconciliation,
  getFunnelSummary,
  getObservabilityStats,
  trackFunnelEvent,
  trackGuestEvents,
  getGuestActivity,
  clearAnalyticsData,
  getPendingCounts,
} from "../controllers/statsController";
import {
  getInfraOverviewController,
  getInfraMetricsController,
} from "../controllers/infraController";
import {
  authMiddleware,
  adminMiddleware,
  superAdminMiddleware,
  requirePermission,
} from "../../middleware/auth";
import { funnelEventSchema, guestEventSchema } from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";
import { guestTrackRateLimiter } from "../../middleware/rateLimit";

const router = Router();

router.get("/public", getPublicPlatformStats);

// Public, anonymous visitor activity ingest (no auth — not-signed-in guests).
// Rate-limited and schema-validated; stores no personal data.
router.post(
  "/guest/event",
  guestTrackRateLimiter,
  validateRequest(guestEventSchema),
  trackGuestEvents,
);

// Authenticated events (players/coaches/venue-listers/admins)
router.use(authMiddleware);
router.post(
  "/funnel/event",
  validateRequest(funnelEventSchema),
  trackFunnelEvent,
);

// All routes below require admin authentication
router.use(adminMiddleware);

// Basic app-shell data every admin needs regardless of role: the dashboard
// landing page and sidebar nav badges. Deliberately left ungated beyond
// "is an active admin" — restricting these would break the home page for
// any role whose custom permission set doesn't happen to include the
// permission chosen here.
router.get("/platform", getPlatformStats);
router.get("/pending-counts", getPendingCounts);

// Destructive / irreversible — reserved for System Admin, same tier as
// admin-account creation.
router.delete("/analytics", superAdminMiddleware, clearAnalyticsData);

// AWS Elastic Beanstalk / CloudWatch infrastructure monitoring — part of the
// Analytics page's Server tab.
router.get(
  "/infra/overview",
  requirePermission("analytics:view"),
  getInfraOverviewController,
);
router.get(
  "/infra/metrics",
  requirePermission("analytics:view"),
  getInfraMetricsController,
);

router.get(
  "/guests/activity",
  requirePermission("analytics:view"),
  getGuestActivity,
);
router.get(
  "/users/growth",
  requirePermission("analytics:view"),
  getUserGrowthAnalytics,
);
router.get(
  "/funnel/summary",
  requirePermission("analytics:view"),
  getFunnelSummary,
);
router.get(
  "/funnel/trends",
  requirePermission("analytics:view"),
  getFunnelTrends,
);
router.get(
  "/finance/reconciliation",
  requirePermission("analytics:view"),
  getFinanceReconciliation,
);
router.get(
  "/observability",
  requirePermission("analytics:view"),
  getObservabilityStats,
);

// Entity list/detail endpoints — gated by the same permission as their
// equivalent admin CRUD routes, since they back the Users/Venues/Bookings
// admin pages (shared by every role that already needs those pages, not
// just Analytics Admin).
router.get("/users/summary", requirePermission("users:view"), getUserRoleSummary);
router.get("/users/players", requirePermission("users:view"), getPlayersUsers);
router.get("/users/coaches", requirePermission("users:view"), getCoachUsers);
router.get(
  "/users/venue-listers",
  requirePermission("users:view"),
  getVenueListerUsers,
);
router.get(
  "/users/analytics/players",
  requirePermission("users:view"),
  getPlayersAnalytics,
);
router.get(
  "/users/analytics/coaches",
  requirePermission("users:view"),
  getCoachesAnalytics,
);
router.get(
  "/users/analytics/venue-listers",
  requirePermission("users:view"),
  getVenueListersAnalytics,
);
router.get("/users", requirePermission("users:view"), getAllUsers);
router.get("/venues", requirePermission("venues:view"), getAllVenues);
router.get("/bookings", requirePermission("bookings:view"), getAllBookings);

export default router;
