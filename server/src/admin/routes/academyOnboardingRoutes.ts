import { Router, Request, Response, NextFunction } from "express";
import {
  startAcademyOnboardingHandler,
  getAcademyProgressHandler,
  saveAcademyStepHandler,
  getImageUploadUrlsHandler,
  confirmImagesHandler,
  getDocumentUploadUrlsHandler,
  confirmDocumentsHandler,
  submitAcademyHandler,
  listApprovedAcademiesHandler,
  getAcademyProfileHandler,
  listPendingAcademiesHandler,
  getAcademyReviewDetailsHandler,
  approveAcademyHandler,
  rejectAcademyHandler,
  markKycVerifiedHandler,
  suspendAcademyHandler,
  createSubscriptionPlanHandler,
  createSessionPackageHandler,
} from "../../client/controllers/academyOnboardingController";
import {
  authMiddleware,
  adminMiddleware,
  requirePermission,
} from "../../middleware/auth";
import { getAcademyEarningsHandler, getAcademyAnalyticsHandler } from "../../client/controllers/academyAnalyticsController";
import { validateRequest } from "../../middleware/validation";
import {
  academyOnboardingStep1Schema,
  academyOnboardingStep2Schema,
  academyOnboardingStep3Schema,
  academyOnboardingStep4Schema,
  academyOnboardingStep5Schema,
  academyOnboardingStep6Schema,
  academyOnboardingStep7Schema,
} from "../../middleware/schemas";

const router = Router();

// Middleware to validate step-specific requests
const validateAcademyStep = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const stepNumber = parseInt(
    (req.params as Record<string, unknown>).stepNumber as string,
  );

  const stepSchemas: Record<number, any> = {
    2: academyOnboardingStep2Schema,
    3: academyOnboardingStep3Schema,
    4: academyOnboardingStep4Schema,
    5: academyOnboardingStep5Schema,
    6: academyOnboardingStep6Schema,
    7: academyOnboardingStep7Schema,
  };

  const schema = stepSchemas[stepNumber];
  if (!schema) {
    return res.status(400).json({
      success: false,
      message: "Invalid step number. Must be between 2 and 7.",
    });
  }

  // Remove academyId from body since it's in URL - add it back for validation if schema expects it
  const bodyToValidate = { ...req.body };

  // Validate request body against step schema
  const validation = schema.safeParse(bodyToValidate);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.issues.map((issue: any) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  next();
};

/**
 * ============================================
 * PUBLIC ROUTES (No Auth Required)
 * ============================================
 */

/**
 * STEP 1: Start academy onboarding
 * POST /api/academies/onboarding/start
 */
router.post(
  "/onboarding/start",
  validateRequest(academyOnboardingStep1Schema),
  startAcademyOnboardingHandler,
);

/**
 * GET: Academy onboarding progress
 * GET /api/academies/onboarding/:academyId/progress
 */
router.get("/onboarding/:academyId/progress", getAcademyProgressHandler);

/**
 * PUT: Save any step (2-7)
 * PUT /api/academies/onboarding/:academyId/step/:stepNumber
 */
router.put(
  "/onboarding/:academyId/step/:stepNumber",
  validateAcademyStep,
  saveAcademyStepHandler,
);

/**
 * POST: Get image upload presigned URLs
 * POST /api/academies/onboarding/:academyId/image-upload-urls
 */
router.post(
  "/onboarding/:academyId/image-upload-urls",
  getImageUploadUrlsHandler,
);

/**
 * POST: Confirm images uploaded
 * POST /api/academies/onboarding/:academyId/confirm-images
 */
router.post("/onboarding/:academyId/confirm-images", confirmImagesHandler);

/**
 * POST: Get document upload presigned URLs
 * POST /api/academies/onboarding/:academyId/document-upload-urls
 */
router.post(
  "/onboarding/:academyId/document-upload-urls",
  getDocumentUploadUrlsHandler,
);

/**
 * POST: Confirm documents uploaded
 * POST /api/academies/onboarding/:academyId/confirm-documents
 */
router.post(
  "/onboarding/:academyId/confirm-documents",
  confirmDocumentsHandler,
);

/**
 * POST: Submit academy for approval
 * POST /api/academies/onboarding/:academyId/submit
 */
router.post("/onboarding/:academyId/submit", submitAcademyHandler);

/**
 * GET: List all approved academies (public discovery)
 * GET /api/academies?city=Mumbai&sport=Basketball&page=1&limit=20
 */
router.get("/", listApprovedAcademiesHandler);

/**
 * GET: Single academy profile
 * GET /api/academies/:slug
 */
router.get("/:slug", getAcademyProfileHandler);

/**
 * ============================================
 * ADMIN ROUTES (Requires Admin Auth)
 * ============================================
 */

/**
 * GET: List pending academies (admin)
 * GET /api/admin/academies?page=1&limit=20&filter=pending
 */
router.get(
  "/admin/pending",
  authMiddleware,
  adminMiddleware,
  requirePermission("academies:view"),
  listPendingAcademiesHandler,
);

/**
 * GET: Academy review details (admin)
 * GET /api/admin/academies/:academyId/review
 */
router.get(
  "/admin/:academyId/review",
  authMiddleware,
  adminMiddleware,
  requirePermission("academies:view"),
  getAcademyReviewDetailsHandler,
);

/**
 * PUT: Approve academy (admin)
 * PUT /api/admin/academies/:academyId/approve
 */
router.put(
  "/admin/:academyId/approve",
  authMiddleware,
  adminMiddleware,
  requirePermission("academies:manage"),
  approveAcademyHandler,
);

/**
 * PUT: Reject academy (admin)
 * PUT /api/admin/academies/:academyId/reject
 * Body: { rejectionReason: string }
 */
router.put(
  "/admin/:academyId/reject",
  authMiddleware,
  adminMiddleware,
  requirePermission("academies:manage"),
  rejectAcademyHandler,
);

/**
 * PUT: Mark KYC verified (admin)
 * PUT /api/admin/academies/:academyId/kyc-verify
 */
router.put(
  "/admin/:academyId/kyc-verify",
  authMiddleware,
  adminMiddleware,
  requirePermission("academies:manage"),
  markKycVerifiedHandler,
);

/**
 * PUT: Suspend academy (admin)
 * PUT /api/admin/academies/:academyId/suspend
 * Body: { reason?: string }
 */
router.put(
  "/admin/:academyId/suspend",
  authMiddleware,
  adminMiddleware,
  requirePermission("academies:manage"),
  suspendAcademyHandler,
);

/**
 * ============================================
 * SUBSCRIPTION & PACKAGE ROUTES
 * ============================================
 */

/**
 * POST: Create subscription plan
 * POST /api/academies/:academyId/subscriptions
 * Requires: authMiddleware (owner verification)
 */
router.post(
  "/:academyId/subscriptions",
  authMiddleware,
  createSubscriptionPlanHandler,
);

/**
 * POST: Create session package
 * POST /api/academies/:academyId/packages
 * Requires: authMiddleware (owner verification)
 */
router.post(
  "/:academyId/packages",
  authMiddleware,
  createSessionPackageHandler,
);

// Academy owner analytics (authenticated, not admin)
router.get("/my/earnings", authMiddleware, getAcademyEarningsHandler);
router.get("/my/analytics", authMiddleware, getAcademyAnalyticsHandler);

export default router;
