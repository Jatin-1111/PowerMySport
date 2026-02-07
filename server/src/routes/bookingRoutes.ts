import { Router } from "express";
import {
  cancelBookingById,
  checkInBookingByToken,
  completeBookingById,
  getMyBookings,
  getVenueAvailability,
  initiateNewBooking,
  markBookingNoShow,
  paymentWebhookHandler,
  processMockPaymentHandler,
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

// Check-in to booking with QR code
router.post("/check-in/:token", checkInBookingByToken);

// Mark booking as completed (venue owner or admin only)
router.post("/:bookingId/complete", authMiddleware, completeBookingById);

// Mark booking as no-show (venue owner or admin only)
router.post("/:bookingId/no-show", authMiddleware, markBookingNoShow);

// Get user's bookings
router.get("/my-bookings", authMiddleware, getMyBookings);

// Get venue availability
router.get("/availability/:venueId", getVenueAvailability);

// Cancel booking
router.delete("/:bookingId", authMiddleware, cancelBookingById);

export default router;
