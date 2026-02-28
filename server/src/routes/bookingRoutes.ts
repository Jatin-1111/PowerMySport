import { Router } from "express";
import {
  cancelBookingById,
  checkInBookingWithCode,
  confirmMockPaymentSuccessById,
  getBookingById,
  getMyBookings,
  getVenueAvailability,
  initiateNewBooking,
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

// Get user's bookings
router.get(
  "/my-bookings",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  getMyBookings,
);

// Get venue availability
router.get("/availability/:venueId", getVenueAvailability);

// Get booking by ID
router.get(
  "/:bookingId",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  getBookingById,
);

// Cancel booking
router.delete(
  "/:bookingId",
  authMiddleware,
  coachVerificationCompletedMiddleware,
  cancelBookingById,
);

export default router;
