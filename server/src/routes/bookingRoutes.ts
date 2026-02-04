import { Router } from "express";
import {
  initiateNewBooking,
  getMyBookings,
  getVenueAvailability,
  cancelBookingById,
  processMockPaymentHandler,
  paymentWebhookHandler,
  verifyBookingByToken,
} from "../controllers/bookingController";
import { authMiddleware } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { bookingSchema } from "../middleware/schemas";

const router = Router();

// Initiate booking with split payments
router.post(
  "/initiate",
  authMiddleware,
  validateRequest(bookingSchema),
  initiateNewBooking,
);

// Mock payment processing (for testing)
router.post("/mock-payment", processMockPaymentHandler);

// Payment webhook handler
router.post("/webhook", paymentWebhookHandler);

// Verify booking with token
router.get("/verify/:token", verifyBookingByToken);

// Get user's bookings
router.get("/my-bookings", authMiddleware, getMyBookings);

// Get venue availability
router.get("/availability/:venueId", getVenueAvailability);

// Cancel booking
router.delete("/:bookingId", authMiddleware, cancelBookingById);

export default router;
