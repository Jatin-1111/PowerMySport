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
} from "../controllers/statsController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
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

export default router;
