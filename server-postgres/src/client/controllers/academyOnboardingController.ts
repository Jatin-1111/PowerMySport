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
import prisma from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
import { getPaginationParams } from "../../utils/pagination";
import { ADMIN_ROLES } from "../../constants/adminPermissions";

// Helper to check if role is admin
const isAdminRole = (role: string): boolean => {
  return Object.values(ADMIN_ROLES).includes(
    role as (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES],
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
export const startAcademyOnboardingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academy = await startAcademyOnboarding(req.body);

    res.status(201).json({
      success: true,
      message: "Academy onboarding started. Proceed to Step 2.",
      data: {
        academyId: academy.id,
        name: academy.name,
        slug: academy.slug,
        currentStep: 1,
        nextStep: "Enter location & contact details",
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to start onboarding",
    });
  }
};

/**
 * GET: Academy onboarding progress
 * GET /api/academies/onboarding/:academyId/progress
 */
export const getAcademyProgressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const progress = await getAcademyOnboardingProgress(academyId);

    res.status(200).json({
      success: true,
      message: "Progress retrieved",
      data: progress,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get progress",
    });
  }
};

/**
 * PUT: Save any onboarding step (2-7)
 * PUT /api/academies/onboarding/:academyId/step/:stepNumber
 * Body: { stepData: {...} }
 */
export const saveAcademyStepHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const stepNumber = parseInt(
      (req.params as Record<string, unknown>).stepNumber as string,
    );

    if (stepNumber < 2 || stepNumber > 7) {
      res.status(400).json({
        success: false,
        message: "Invalid step number. Must be between 2 and 7.",
      });
      return;
    }

    const academy = await updateAcademyStep(academyId, stepNumber, req.body);

    res.status(200).json({
      success: true,
      message: `Step ${stepNumber} saved successfully.`,
      data: {
        academyId: academy.id,
        currentStep: academy.onboardingStep,
        nextStep:
          stepNumber < 7 ? `Step ${stepNumber + 1}` : "Submit for review",
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to save step",
    });
  }
};

/**
 * GET: Image upload presigned URLs
 * POST /api/academies/onboarding/:academyId/image-upload-urls
 * Body: { imageTypes: ['logo', 'coverPhoto', 'galleryPhotos'] }
 */
export const getImageUploadUrlsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const { imageTypes } = req.body;

    if (!imageTypes || imageTypes.length === 0) {
      res.status(400).json({
        success: false,
        message: "Image types are required",
      });
      return;
    }

    // Verify academy exists
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
    });
    if (!academy) {
      res.status(404).json({
        success: false,
        message: "Academy not found",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get upload URLs",
    });
  }
};

/**
 * POST: Confirm images uploaded
 * POST /api/academies/onboarding/:academyId/confirm-images
 * Body: { logoUrl, logoKey, coverPhotoUrl, coverPhotoKey, galleryPhotoUrls[], galleryPhotoKeys[] }
 */
export const confirmImagesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;

    // Verify academy exists
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
    });
    if (!academy) {
      res.status(404).json({
        success: false,
        message: "Academy not found",
      });
      return;
    }

    const updatedAcademy = await confirmAcademyImages(academyId, req.body);

    res.status(200).json({
      success: true,
      message: "Images confirmed successfully",
      data: {
        academyId: updatedAcademy?.id,
        logoUrl: updatedAcademy?.logoUrl,
        coverPhotoUrl: updatedAcademy?.coverPhotoUrl,
        galleryPhotosCount: updatedAcademy?.photos.length,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to confirm images",
    });
  }
};

/**
 * GET: Document upload presigned URLs
 * POST /api/academies/onboarding/:academyId/document-upload-urls
 * Body: { docTypes: ['panDocument', 'gstDocument'] }
 */
export const getDocumentUploadUrlsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const { docTypes } = req.body;

    if (!docTypes || docTypes.length === 0) {
      res.status(400).json({
        success: false,
        message: "Document types are required",
      });
      return;
    }

    // Verify academy exists
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
    });
    if (!academy) {
      res.status(404).json({
        success: false,
        message: "Academy not found",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to get upload URLs",
    });
  }
};

/**
 * POST: Confirm documents uploaded
 * POST /api/academies/onboarding/:academyId/confirm-documents
 * Body: { panDocumentUrl, panDocumentKey, gstDocumentUrl, gstDocumentKey }
 */
export const confirmDocumentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;

    // Verify academy exists
    const academy = await prisma.academy.findUnique({
      where: { id: academyId },
    });
    if (!academy) {
      res.status(404).json({
        success: false,
        message: "Academy not found",
      });
      return;
    }

    const updatedAcademy = await confirmAcademyDocuments(academyId, req.body);

    res.status(200).json({
      success: true,
      message: "Documents confirmed successfully",
      data: {
        academyId: updatedAcademy?.id,
        panDocumentUrl: updatedAcademy?.panDocumentUrl,
        gstDocumentUrl: updatedAcademy?.gstDocumentUrl,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to confirm documents",
    });
  }
};

/**
 * POST: Submit academy for approval
 * POST /api/academies/onboarding/:academyId/submit
 */
export const submitAcademyHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;

    const academy = await submitAcademyForApproval(academyId);

    res.status(200).json({
      success: true,
      message:
        "Academy submitted for review. You will be notified once approved.",
      data: {
        academyId: academy.id,
        name: academy.name,
        status: "Under Review",
        nextSteps: [
          "Wait for admin approval",
          "Complete KYC verification",
          "Go live once approved and KYC verified",
        ],
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to submit academy",
    });
  }
};

/**
 * GET: List approved academies (public discovery)
 * GET /api/academies?city=Mumbai&sport=Basketball&page=1&limit=20
 */
export const listApprovedAcademiesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
      20,
      100,
    );
    const city = (req.query.city as string) || undefined;
    const sport = (req.query.sport as string) || undefined;

    const query: Prisma.AcademyWhereInput = {
      isApproved: true,
      kycVerified: true,
      isActive: true,
    };

    if (city) {
      query.city = { contains: city, mode: "insensitive" };
    }

    if (sport) {
      query.sports = { has: sport };
    }

    const skip = (page - 1) * limit;
    const total = await prisma.academy.count({ where: query });

    const academies = await prisma.academy.findMany({
      where: query,
      skip,
      take: limit,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
    });

    res.status(200).json({
      success: true,
      message: "Approved academies retrieved",
      data: {
        academies: academies.map((a) => ({
          id: a.id.toString(),
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch academies",
    });
  }
};

/**
 * GET: Single academy profile
 * GET /api/academies/:slug
 */
export const getAcademyProfileHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const slug = (req.params as Record<string, unknown>).slug as string;

    const academy = await prisma.academy.findFirst({
      where: {
        slug,
        isApproved: true,
        kycVerified: true,
        isActive: true,
      },
    });

    if (!academy) {
      res.status(404).json({
        success: false,
        message: "Academy not found",
      });
      return;
    }

    // Replace Mongoose .populate() with follow-up lookups (String-FK refs).
    // ownerId -> owner user (name/email/phone); subscription plans & session
    // packages are looked up by academyId (were Mongoose virtuals).
    const [owner, subscriptionPlans, sessionPackages] = await Promise.all([
      academy.ownerId
        ? prisma.user.findUnique({
            where: { id: academy.ownerId },
            select: { name: true, email: true, phone: true },
          })
        : Promise.resolve(null),
      prisma.subscriptionPlan.findMany({ where: { academyId: academy.id } }),
      prisma.sessionPackage.findMany({ where: { academyId: academy.id } }),
    ]);

    res.status(200).json({
      success: true,
      message: "Academy profile retrieved",
      data: {
        ...academy,
        ownerId: owner ?? academy.ownerId,
        subscriptionPlans,
        sessionPackages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch academy",
    });
  }
};

/**
 * ============================================
 * ADMIN ENDPOINTS (Requires Admin Auth)
 * ============================================
 */

/**
 * GET: List all pending academies
 * GET /api/academies/admin/pending?page=1&limit=20&filter=pending
 */
export const listPendingAcademiesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
      20,
      100,
    );
    const filter = (req.query.filter as string) || undefined;

    const result = await getPendingAcademies(
      page,
      limit,
      filter as "pending" | "approved" | "rejected" | undefined,
    );

    res.status(200).json({
      success: true,
      message: "Pending academies retrieved",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch pending academies",
    });
  }
};

/**
 * GET: Academy details for admin review
 * GET /api/academies/admin/:academyId/review
 */
export const getAcademyReviewDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const academy = await getAcademyOnboardingDetails(academyId);

    if (!academy) {
      res.status(404).json({
        success: false,
        message: "Academy not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Academy review details retrieved",
      data: academy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch details",
    });
  }
};

/**
 * PUT: Approve academy
 * PUT /api/academies/admin/:academyId/approve
 */
export const approveAcademyHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const academy = await approveAcademy(academyId);

    res.status(200).json({
      success: true,
      message: "Academy approved successfully",
      data: {
        academyId: academy?.id,
        name: academy?.name,
        isApproved: true,
        isActive: academy?.kycVerified ? true : false,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to approve academy",
    });
  }
};

/**
 * PUT: Reject academy
 * PUT /api/academies/admin/:academyId/reject
 * Body: { rejectionReason: string }
 */
export const rejectAcademyHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
      return;
    }

    const academy = await rejectAcademy(academyId, rejectionReason);

    res.status(200).json({
      success: true,
      message: "Academy rejected successfully",
      data: {
        academyId: academy?.id,
        name: academy?.name,
        isApproved: false,
        rejectionReason,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to reject academy",
    });
  }
};

/**
 * PUT: Mark academy as KYC verified
 * PUT /api/academies/admin/:academyId/kyc-verify
 */
export const markKycVerifiedHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const academy = await markAcademyKycVerified(academyId);

    res.status(200).json({
      success: true,
      message: "KYC verification marked",
      data: {
        academyId: academy?.id,
        name: academy?.name,
        kycVerified: true,
        isActive: academy?.isActive,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to mark KYC verified",
    });
  }
};

/**
 * PUT: Suspend academy
 * PUT /api/academies/admin/:academyId/suspend
 * Body: { reason?: string }
 */
export const suspendAcademyHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;
    const { reason } = req.body;

    const academy = await suspendAcademy(academyId, reason);

    res.status(200).json({
      success: true,
      message: "Academy suspended successfully",
      data: {
        academyId: academy?.id,
        name: academy?.name,
        isActive: false,
        reason: reason || "No reason provided",
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to suspend academy",
    });
  }
};

/**
 * ============================================
 * SUBSCRIPTION & PACKAGE MANAGEMENT
 * ============================================
 */

/**
 * POST: Create subscription plan
 * POST /api/academies/:academyId/subscriptions
 */
export const createSubscriptionPlanHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;

    const plan = await createSubscriptionPlan({
      ...req.body,
      academyId,
    });

    res.status(201).json({
      success: true,
      message: "Subscription plan created",
      data: plan,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create plan",
    });
  }
};

/**
 * POST: Create session package
 * POST /api/academies/:academyId/packages
 */
export const createSessionPackageHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const academyId = (req.params as Record<string, unknown>)
      .academyId as string;

    const pkg = await createSessionPackage({
      ...req.body,
      academyId,
    });

    res.status(201).json({
      success: true,
      message: "Session package created",
      data: pkg,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create package",
    });
  }
};
