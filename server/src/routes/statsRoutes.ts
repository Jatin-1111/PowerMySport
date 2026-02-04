import { Router } from "express";
import {
  getPlatformStats,
  getAllUsers,
  getAllVenues,
  getAllBookings,
} from "../controllers/statsController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/platform", getPlatformStats);
router.get("/users", getAllUsers);
router.get("/venues", getAllVenues);
router.get("/bookings", getAllBookings);

export default router;
