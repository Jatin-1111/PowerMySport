import { Router } from "express";
import {
  cancelBookingById,
  checkInBookingWithCode,
  confirmMockPaymentSuccessById,
  getBookingById,
  getMyBookings,
  joinBookingWaitlist,
  getVenueAvailability,
  initiateNewBooking,
  initiateNewGroupBooking,
  respondToInvitation,
  getMyInvitations,
  coverUnpaidPayments,
  getPendingInvitationsCount,
  validateBookingPromoCode,
} from "../controllers/bookingController";
import {
  authMiddleware,
  coachVerificationCompletedMiddleware,
  playerOnlyMiddleware,
} from "../middleware/auth";
import {
  bookingCheckInCodeSchema,
  bookingSchema,
  bookingWaitlistSchema,
  promoValidateSchema,
} from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

// Initiate booking with split payments
router.post(
  "/promo/validate",
  authMiddleware,
  playerOnlyMiddleware,
  validateRequest(promoValidateSchema),
  validateBookingPromoCode,
);

router.post(
  "/waitlist",
  authMiddleware,
  playerOnlyMiddleware,
  validateRequest(bookingWaitlistSchema),
  joinBookingWaitlist,
);

router.post(
  "/initiate",
  authMiddleware,
  playerOnlyMiddleware,
  coachVerificationCompletedMiddleware,
  validateRequest(bookingSchema),
  initiateNewBooking,
);

// Initiate group booking with friends
router.post(
  "/initiate-group",
  authMiddleware,
  playerOnlyMiddleware,
  coachVerificationCompletedMiddleware,
  initiateNewGroupBooking,
);

// Get booking invitations
router.get(
  "/invitations",
  authMiddleware,
  playerOnlyMiddleware,
  getMyInvitations,
);

// Get pending invitations count
router.get(
  "/invitations/pending-count",
  authMiddleware,
  playerOnlyMiddleware,
  getPendingInvitationsCount,
);

// Respond to booking invitation
router.post(
  "/invitations/:invitationId/respond",
  authMiddleware,
  playerOnlyMiddleware,
  respondToInvitation,
);

// Organizer covers unpaid shares
router.post(
  "/:bookingId/cover-payments",
  authMiddleware,
  playerOnlyMiddleware,
  coverUnpaidPayments,
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
