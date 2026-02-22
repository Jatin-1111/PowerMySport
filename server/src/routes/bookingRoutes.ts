import { Router } from "express";
import {
  cancelBookingById,
  checkInBookingWithCode,
  confirmMockPaymentSuccessById,
  completeBookingById,
  getMyBookings,
  getVenueAvailability,
  initiateNewBooking,
  markBookingNoShow,
} from "../controllers/bookingController";
import {
  authMiddleware,
  coachVerificationCompletedMiddleware,
} from "../middleware/auth";
import { bookingCheckInCodeSchema, bookingSchema } from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

// Initiate booking with split payments
router.post(
  "/initiate",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  validateRequest(bookingSchema),
  initiateNewBooking,
);

// Check-in to booking with random code
router.post(
  "/check-in/code",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  validateRequest(bookingCheckInCodeSchema),
  checkInBookingWithCode,
);

// Confirm mock payment success and trigger booking confirmation email
router.post(
  "/:bookingId/mock-payment-success",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  confirmMockPaymentSuccessById,
);

// Mark booking as completed (venue owner or admin only)
router.post(
  "/:bookingId/complete",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  completeBookingById,
);

// Mark booking as no-show (venue owner or admin only)
router.post(
  "/:bookingId/no-show",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  markBookingNoShow,
);

// Get user's bookings
router.get(
  "/my-bookings",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  getMyBookings,
);

// Get venue availability
router.get("/availability/:venueId", getVenueAvailability);

// Cancel booking
router.delete(
  "/:bookingId",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  cancelBookingById,
);

export default router;
