import { Request, Response } from "express";
import {
  startAcademyOnboarding,
  updateAcademyStep,
  getAcademyOnboardingProgress,
  getImageUploadPresignedUrls,
  confirmAcademyImages,
  getDocumentUploadPresignedUrls,
  confirmAcademyDocuments,
  submitAcademyForApproval,
  getPendingAcademies,
  getAcademyOnboardingDetails,
  approveAcademy,
  rejectAcademy,
  markAcademyKycVerified,
  suspendAcademy,
  createSubscriptionPlan,
  createSessionPackage,
  UPLOAD_CONSTRAINTS,
} from "../../admin/services/AcademyOnboardingService";
import Academy from "../../admin/models/Academy";
import { getPaginationParams } from "../../utils/pagination";
import { ADMIN_ROLES } from "../../constants/adminPermissions";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// Helper to check if role is admin
const isAdminRole = (role: string): boolean => {
  return Object.values(ADMIN_ROLES).includes(
    role as (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES]
  );
};

/**
 * ============================================
 * PUBLIC ENDPOINTS (No Auth Required)
 * ============================================
 */

/**
 * STEP 1: Start academy onboarding
 * POST /api/academies/onboarding/start
 * Body: { ownerEmail, ownerName, ownerPhone, name, legalName, sports[], ageGroups[], ... }
 */
export const startAcademyOnboardingHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academy = await startAcademyOnboarding(req.body);

    res.status(201).json({
      success: true,
      message: "Academy onboarding started. Proceed to Step 2.",
      data: {
        academyId: academy._id,
        name: academy.name,
        slug: academy.slug,
        currentStep: 1,
        nextStep: "Enter location & contact details",
      },
    });
  }
);

/**
 * GET: Academy onboarding progress
 * GET /api/academies/onboarding/:academyId/progress
 */
export const getAcademyProgressHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const progress = await getAcademyOnboardingProgress(academyId);

    res.status(200).json({
      success: true,
      message: "Progress retrieved",
      data: progress,
    });
  }
);

/**
 * PUT: Save any onboarding step (2-7)
 * PUT /api/academies/onboarding/:academyId/step/:stepNumber
 * Body: { stepData: {...} }
 */
export const saveAcademyStepHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const stepNumber = parseInt((req.params as Record<string, unknown>).stepNumber as string);

    if (stepNumber < 2 || stepNumber > 7) {
      throw new AppError("Invalid step number. Must be between 2 and 7.", 400);
    }

    const academy = await updateAcademyStep(academyId, stepNumber, req.body);

    res.status(200).json({
      success: true,
      message: `Step ${stepNumber} saved successfully.`,
      data: {
        academyId: academy._id,
        currentStep: academy.onboardingStep,
        nextStep: stepNumber < 7 ? `Step ${stepNumber + 1}` : "Submit for review",
      },
    });
  }
);

/**
 * GET: Image upload presigned URLs
 * POST /api/academies/onboarding/:academyId/image-upload-urls
 * Body: { imageTypes: ['logo', 'coverPhoto', 'galleryPhotos'] }
 */
export const getImageUploadUrlsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const { imageTypes } = req.body;

    if (!imageTypes || imageTypes.length === 0) {
      throw new AppError("Image types are required", 400);
    }

    // Verify academy exists
    const academy = await Academy.findById(academyId);
    if (!academy) {
      throw new AppError("Academy not found", 404);
    }

    const urls = await getImageUploadPresignedUrls(academyId, imageTypes);

    res.status(200).json({
      success: true,
      message: "Upload images to provided URLs",
      data: {
        uploadUrls: urls,
        constraints: UPLOAD_CONSTRAINTS.IMAGES,
      },
    });
  }
);

/**
 * POST: Confirm images uploaded
 * POST /api/academies/onboarding/:academyId/confirm-images
 * Body: { logoUrl, logoKey, coverPhotoUrl, coverPhotoKey, galleryPhotoUrls[], galleryPhotoKeys[] }
 */
export const confirmImagesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;

    // Verify academy exists
    const academy = await Academy.findById(academyId);
    if (!academy) {
      throw new AppError("Academy not found", 404);
    }

    const updatedAcademy = await confirmAcademyImages(academyId, req.body);

    res.status(200).json({
      success: true,
      message: "Images confirmed successfully",
      data: {
        academyId: updatedAcademy?._id,
        logoUrl: updatedAcademy?.logoUrl,
        coverPhotoUrl: updatedAcademy?.coverPhotoUrl,
        galleryPhotosCount: updatedAcademy?.photos.length,
      },
    });
  }
);

/**
 * GET: Document upload presigned URLs
 * POST /api/academies/onboarding/:academyId/document-upload-urls
 * Body: { docTypes: ['panDocument', 'gstDocument'] }
 */
export const getDocumentUploadUrlsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const { docTypes } = req.body;

    if (!docTypes || docTypes.length === 0) {
      throw new AppError("Document types are required", 400);
    }

    // Verify academy exists
    const academy = await Academy.findById(academyId);
    if (!academy) {
      throw new AppError("Academy not found", 404);
    }

    const urls = await getDocumentUploadPresignedUrls(academyId, docTypes);

    res.status(200).json({
      success: true,
      message: "Upload documents to provided URLs",
      data: {
        uploadUrls: urls,
        constraints: UPLOAD_CONSTRAINTS.DOCUMENTS,
      },
    });
  }
);

/**
 * POST: Confirm documents uploaded
 * POST /api/academies/onboarding/:academyId/confirm-documents
 * Body: { panDocumentUrl, panDocumentKey, gstDocumentUrl, gstDocumentKey }
 */
export const confirmDocumentsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;

    // Verify academy exists
    const academy = await Academy.findById(academyId);
    if (!academy) {
      throw new AppError("Academy not found", 404);
    }

    const updatedAcademy = await confirmAcademyDocuments(academyId, req.body);

    res.status(200).json({
      success: true,
      message: "Documents confirmed successfully",
      data: {
        academyId: updatedAcademy?._id,
        panDocumentUrl: updatedAcademy?.panDocumentUrl,
        gstDocumentUrl: updatedAcademy?.gstDocumentUrl,
      },
    });
  }
);

/**
 * POST: Submit academy for approval
 * POST /api/academies/onboarding/:academyId/submit
 */
export const submitAcademyHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;

    const academy = await submitAcademyForApproval(academyId);

    res.status(200).json({
      success: true,
      message: "Academy submitted for review. You will be notified once approved.",
      data: {
        academyId: academy._id,
        name: academy.name,
        status: "Under Review",
        nextSteps: [
          "Wait for admin approval",
          "Complete KYC verification",
          "Go live once approved and KYC verified",
        ],
      },
    });
  }
);

/**
 * GET: List approved academies (public discovery)
 * GET /api/academies?city=Mumbai&sport=Basketball&page=1&limit=20
 */
export const listApprovedAcademiesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);
    const city = (req.query.city as string) || undefined;
    const sport = (req.query.sport as string) || undefined;

    const query: any = {
      isApproved: true,
      kycVerified: true,
      isActive: true,
    };

    if (city) {
      query.city = { $regex: city, $options: "i" };
    }

    if (sport) {
      query.sports = { $in: [sport] };
    }

    const skip = (page - 1) * limit;
    const total = await Academy.countDocuments(query);

    const academies = await Academy.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ rating: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Approved academies retrieved",
      data: {
        academies: academies.map((a) => ({
          id: a._id.toString(),
          name: a.name,
          slug: a.slug,
          city: a.city,
          sports: a.sports,
          rating: a.rating,
          reviewCount: a.reviewCount,
          sessionRatePerHour: a.sessionRatePerHour,
          logoUrl: a.logoUrl,
          coverPhotoUrl: a.coverPhotoUrl,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  }
);

/**
 * GET: Single academy profile
 * GET /api/academies/:slug
 */
export const getAcademyProfileHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const slug = (req.params as Record<string, unknown>).slug as string;

    const academy = await Academy.findOne({
      slug,
      isApproved: true,
      kycVerified: true,
      isActive: true,
    })
      .populate("ownerId", "name email phone")
      .populate("subscriptionPlans")
      .populate("sessionPackages");

    if (!academy) {
      throw new AppError("Academy not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Academy profile retrieved",
      data: academy,
    });
  }
);

/**
 * ============================================
 * ADMIN ENDPOINTS (Requires Admin Auth)
 * ============================================
 */

/**
 * GET: List all pending academies
 * GET /api/academies/admin/pending?page=1&limit=20&filter=pending
 */
export const listPendingAcademiesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);
    const filter = (req.query.filter as string) || undefined;

    const result = await getPendingAcademies(
      page,
      limit,
      filter as "pending" | "approved" | "rejected" | undefined
    );

    res.status(200).json({
      success: true,
      message: "Pending academies retrieved",
      data: result,
    });
  }
);

/**
 * GET: Academy details for admin review
 * GET /api/academies/admin/:academyId/review
 */
export const getAcademyReviewDetailsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const academy = await getAcademyOnboardingDetails(academyId);

    if (!academy) {
      throw new AppError("Academy not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Academy review details retrieved",
      data: academy,
    });
  }
);

/**
 * PUT: Approve academy
 * PUT /api/academies/admin/:academyId/approve
 */
export const approveAcademyHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const academy = await approveAcademy(academyId);

    res.status(200).json({
      success: true,
      message: "Academy approved successfully",
      data: {
        academyId: academy?._id,
        name: academy?.name,
        isApproved: true,
        isActive: academy?.kycVerified ? true : false,
      },
    });
  }
);

/**
 * PUT: Reject academy
 * PUT /api/academies/admin/:academyId/reject
 * Body: { rejectionReason: string }
 */
export const rejectAcademyHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      throw new AppError("Rejection reason is required", 400);
    }

    const academy = await rejectAcademy(academyId, rejectionReason);

    res.status(200).json({
      success: true,
      message: "Academy rejected successfully",
      data: {
        academyId: academy?._id,
        name: academy?.name,
        isApproved: false,
        rejectionReason,
      },
    });
  }
);

/**
 * PUT: Mark academy as KYC verified
 * PUT /api/academies/admin/:academyId/kyc-verify
 */
export const markKycVerifiedHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const academy = await markAcademyKycVerified(academyId);

    res.status(200).json({
      success: true,
      message: "KYC verification marked",
      data: {
        academyId: academy?._id,
        name: academy?.name,
        kycVerified: true,
        isActive: academy?.isActive,
      },
    });
  }
);

/**
 * PUT: Suspend academy
 * PUT /api/academies/admin/:academyId/suspend
 * Body: { reason?: string }
 */
export const suspendAcademyHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const academyId = (req.params as Record<string, unknown>).academyId as string;
    const { reason } = req.body;

    const academy = await suspendAcademy(academyId, reason);

    res.status(200).json({
      success: true,
      message: "Academy suspended successfully",
      data: {
        academyId: academy?._id,
        name: academy?.name,
        isActive: false,
        reason: reason || "No reason provided",
      },
    });
  }
);

/**
 * ============================================
 * SUBSCRIPTION & PACKAGE MANAGEMENT
 * ============================================
 */

/**
 * POST: Create subscription plan
 * POST /api/academies/:academyId/subscriptions
 */
export const createSubscriptionPlanHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;

    const plan = await createSubscriptionPlan({
      ...req.body,
      academyId,
    });

    res.status(201).json({
      success: true,
      message: "Subscription plan created",
      data: plan,
    });
  }
);

/**
 * POST: Create session package
 * POST /api/academies/:academyId/packages
 */
export const createSessionPackageHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const academyId = (req.params as Record<string, unknown>).academyId as string;

    const pkg = await createSessionPackage({
      ...req.body,
      academyId,
    });

    res.status(201).json({
      success: true,
      message: "Session package created",
      data: pkg,
    });
  }
);
