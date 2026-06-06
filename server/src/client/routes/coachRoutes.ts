import { Router } from "express";
import {
  createNewCoach,
  discoverCoachesNearby,
  deleteCoachProfile,
  getCoach,
  getCoachAvailability,
  saveCoachVerificationStep1Handler,
  saveCoachVerificationStep2Handler,
  getCoachVerificationUploadUrlHandler,
  getMyCoachProfile,
  submitCoachVerificationStep3Handler,
  submitCoachVerificationHandler,
  updateMyCoachAvailability,
  updateCoachProfile,
} from "../controllers/coachController";
import {
  cancelMyCoachSubscriptionHandler,
  createOrUpdateMyCoachSubscriptionHandler,
  getMyCoachSubscriptionHandler,
  listCoachPlansHandler,
} from "../controllers/coachSubscriptionController";
import {
  createCoachPackageHandler,
  getCoachPackagesHandler,
  getCoachPublicPackagesHandler,
  updateCoachPackageHandler,
  deleteCoachPackageHandler,
  subscribeToCoachPackageHandler,
  getUserCoachSubscriptionsHandler,
  cancelSubscriptionHandler,
  getCoachActiveSubscriptionsHandler,
  getCoachSubscriptionRevenueHandler,
  initiateCoachSubscriptionPaymentHandler,
  verifyCoachSubscriptionPaymentStatusHandler,
} from "../controllers/coachSubscriptionPackageController";
import { authMiddleware } from "../../middleware/auth";
import {
  coachSubscriptionCancelSchema,
  coachSubscriptionCreateSchema,
  coachSubscriptionOverrideRequestSchema,
  coachVerificationStep1Schema,
  coachVerificationStep2Schema,
  coachVerificationStep3Schema,
} from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";

const router = Router();

// Discovery endpoint (public) - returns coaches only
router.get("/discover", discoverCoachesNearby);

// Create coach profile (requires authentication and COACH role)
router.post("/", authMiddleware, createNewCoach);

// Get current user's coach profile
router.get("/my-profile", authMiddleware, getMyCoachProfile);

// Update current coach's availability calendar
router.put(
  "/my-profile/availability",
  authMiddleware,
  updateMyCoachAvailability,
);

// Get upload URL for verification documents
router.post(
  "/verification/upload-url",
  authMiddleware,
  getCoachVerificationUploadUrlHandler,
);

// Save verification step 1 (bio)
router.post(
  "/verification/step1",
  authMiddleware,
  validateRequest(coachVerificationStep1Schema),
  saveCoachVerificationStep1Handler,
);

// Save verification step 2 (sports/profile)
router.post(
  "/verification/step2",
  authMiddleware,
  validateRequest(coachVerificationStep2Schema),
  saveCoachVerificationStep2Handler,
);

// Submit verification step 3 (documents)
router.post(
  "/verification/step3",
  authMiddleware,
  validateRequest(coachVerificationStep3Schema),
  submitCoachVerificationStep3Handler,
);

// Submit verification documents
router.post(
  "/verification",
  authMiddleware,
  validateRequest(coachVerificationStep3Schema),
  submitCoachVerificationHandler,
);

// Coach subscription routes
router.get("/subscription/plans", authMiddleware, listCoachPlansHandler);
router.get(
  "/subscription/my-subscription",
  authMiddleware,
  getMyCoachSubscriptionHandler,
);
router.post(
  "/subscription/subscribe",
  authMiddleware,
  validateRequest(coachSubscriptionCreateSchema),
  createOrUpdateMyCoachSubscriptionHandler,
);
router.post(
  "/subscription/cancel",
  authMiddleware,
  validateRequest(coachSubscriptionCancelSchema),
  cancelMyCoachSubscriptionHandler,
);
// Override requests deprecated in new package model

// NEW: Coach subscription packages (flexible coach-owned packages)
// Create package (Coach only)
router.post(
  "/subscription-packages",
  authMiddleware,
  createCoachPackageHandler,
);

// Get own packages (Coach only)
router.get("/subscription-packages", authMiddleware, getCoachPackagesHandler);

// Update package (Coach only)
router.put(
  "/subscription-packages/:packageId",
  authMiddleware,
  updateCoachPackageHandler,
);

// Delete package (Coach only)
router.delete(
  "/subscription-packages/:packageId",
  authMiddleware,
  deleteCoachPackageHandler,
);

// Get coach's active subscriptions (Coach only)
router.get(
  "/subscription-packages/active-subscriptions",
  authMiddleware,
  getCoachActiveSubscriptionsHandler,
);

// Get coach's revenue (Coach only)
router.get(
  "/subscription-packages/revenue",
  authMiddleware,
  getCoachSubscriptionRevenueHandler,
);

// Public endpoints for subscription management
// Subscribe to a coach's package
router.post("/subscriptions", authMiddleware, subscribeToCoachPackageHandler);

// Get user's subscriptions
router.get("/subscriptions", authMiddleware, getUserCoachSubscriptionsHandler);

// Subscription payment flow
router.post(
  "/subscriptions/phonepe/initiate",
  authMiddleware,
  initiateCoachSubscriptionPaymentHandler,
);
router.get(
  "/subscriptions/phonepe/status/:merchantOrderId",
  authMiddleware,
  verifyCoachSubscriptionPaymentStatusHandler,
);

// Cancel subscription
router.delete(
  "/subscriptions/:subscriptionId",
  authMiddleware,
  cancelSubscriptionHandler,
);

// Check coach availability
router.get("/availability/:coachId", getCoachAvailability);

// Get coach's subscription packages (public)
router.get("/:coachId/subscription-packages", getCoachPublicPackagesHandler);

// Get coach by ID (public)
router.get("/:coachId", getCoach);

// Update coach profile
router.put("/:coachId", authMiddleware, updateCoachProfile);

// Delete coach profile
router.delete("/:coachId", authMiddleware, deleteCoachProfile);

export default router;
