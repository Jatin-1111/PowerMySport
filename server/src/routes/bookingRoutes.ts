import { Router } from "express";
import {
  createNewBooking,
  getMyBookings,
  getVenueAvailability,
  cancelBookingById,
} from "../controllers/bookingController";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { bookingSchema } from "../middleware/schemas";

const router = Router();

router.post(
  "/",
  authMiddleware,
  validateRequest(bookingSchema),
  createNewBooking,
);
router.get("/my-bookings", authMiddleware, getMyBookings);
router.get("/availability/:venueId", getVenueAvailability);
router.delete("/:bookingId", authMiddleware, cancelBookingById);

export default router;
