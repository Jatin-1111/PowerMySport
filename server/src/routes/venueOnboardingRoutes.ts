import { Router } from "express";
import {
  createVenueStep1,
  updateVenueDetailsStep2,
  getImageUploadUrls,
  confirmImagesStep2,
  getDocumentUploadUrls,
  finalizeOnboardingStep3,
  deleteVenueOnboardingHandler,
  listPendingVenues,
  getVenueOnboardingDetailsForAdmin,
  approveVenueHandler,
  rejectVenueHandler,
  markVenueForReviewHandler,
} from "../controllers/venueOnboardingController";
import {
  authMiddleware,
  vendorMiddleware,
  adminMiddleware,
} from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import {
  venueOnboardingStep1Schema,
  getImageUploadUrlsSchema,
  venueOnboardingStep2Schema,
  getDocumentUploadUrlsSchema,
  venueOnboardingStep3ImagesSchema,
  venueOnboardingStep4Schema,
  adminRejectVenueSchema,
  adminReviewVenueSchema,
} from "../middleware/schemas";

const router = Router();

// ============================================
// VENUE OWNER ROUTES (PUBLIC - no auth required)
// ============================================

/**
 * STEP 1: Create venue with venue lister contact info
 * POST /api/venues/onboarding/step1
 */
router.post(
  "/step1",
  validateRequest(venueOnboardingStep1Schema),
  createVenueStep1,
);

/**
 * STEP 2: Update venue with detailed information
 * POST /api/venues/onboarding/step2
 */
router.post(
  "/step2",
  validateRequest(venueOnboardingStep2Schema),
  updateVenueDetailsStep2,
);

/**
 * STEP 3A: Get presigned URLs for image uploads
 * POST /api/venues/onboarding/step3/upload-urls
 */
router.post(
  "/step3/upload-urls",
  validateRequest(getImageUploadUrlsSchema),
  getImageUploadUrls,
);

/**
 * STEP 3B: Confirm images and cover photo
 * POST /api/venues/onboarding/step3/confirm
 */
router.post(
  "/step3/confirm",
  validateRequest(venueOnboardingStep3ImagesSchema),
  confirmImagesStep2,
);

/**
 * STEP 4A: Get presigned URLs for document uploads
 * POST /api/venues/onboarding/step4/upload-urls
 */
router.post(
  "/step4/upload-urls",
  validateRequest(getDocumentUploadUrlsSchema),
  getDocumentUploadUrls,
);

/**
 * STEP 4B: Finalize onboarding with documents
 * POST /api/venues/onboarding/step4/finalize
 */
router.post(
  "/step4/finalize",
  validateRequest(venueOnboardingStep4Schema),
  finalizeOnboardingStep3,
);

/**
 * Cancel/Delete onboarding
 * DELETE /api/venues/onboarding/:venueId
 */
router.delete("/:venueId", deleteVenueOnboardingHandler);

// ============================================
// ADMIN ROUTES (Protected - Admin only)
// ============================================

/**
 * List all pending venues
 * GET /api/venues/onboarding/admin/pending?page=1&limit=20&status=PENDING
 */
router.get(
  "/admin/pending",
  authMiddleware,
  adminMiddleware,
  listPendingVenues,
);

/**
 * Get venue details for admin review
 * GET /api/venues/onboarding/admin/:venueId
 */
router.get(
  "/admin/:venueId",
  authMiddleware,
  adminMiddleware,
  getVenueOnboardingDetailsForAdmin,
);

/**
 * Approve venue
 * POST /api/venues/onboarding/admin/:venueId/approve
 */
router.post(
  "/admin/:venueId/approve",
  authMiddleware,
  adminMiddleware,
  approveVenueHandler,
);

/**
 * Reject venue
 * POST /api/venues/onboarding/admin/:venueId/reject
 * Body: { reason: string }
 */
router.post(
  "/admin/:venueId/reject",
  authMiddleware,
  adminMiddleware,
  validateRequest(adminRejectVenueSchema),
  rejectVenueHandler,
);

/**
 * Mark venue for review
 * POST /api/venues/onboarding/admin/:venueId/mark-review
 * Body: { notes?: string }
 */
router.post(
  "/admin/:venueId/mark-review",
  authMiddleware,
  adminMiddleware,
  validateRequest(adminReviewVenueSchema),
  markVenueForReviewHandler,
);

export default router;
