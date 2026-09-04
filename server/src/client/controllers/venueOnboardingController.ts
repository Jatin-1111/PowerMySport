import { Request, Response } from "express";
import { generateToken } from "../../utils/jwt";
import { S3Service } from "../../shared/services/S3Service";
import { Venue } from "../models/Venue";
import {
  startVenueOnboarding,
  getImageUploadPresignedUrls,
  confirmVenueImages,
  getDocumentUploadPresignedUrls,
  finalizeVenueOnboarding,
  getPendingVenues,
  getVenueOnboardingDetails,
  approveVenue,
  rejectVenue,
  markVenueForReview,
  deleteVenueOnboarding,
  updateVenueDetails,
  UPLOAD_CONSTRAINTS,
} from "../services/VenueOnboardingService";
import { sendVerificationCode } from "../../shared/services/EmailVerificationService";
import { getPaginationParams } from "../../utils/pagination";
import { ADMIN_ROLES } from "../../constants/adminPermissions";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// Helper to check if role is an admin role
const isAdminRole = (role: string): boolean => {
  return Object.values(ADMIN_ROLES).includes(role as any);
};

/**
 * Venue Onboarding Controller
 *
 * Handles all venue onboarding endpoints:
 * - Step 1: Create venue with basic details
 * - Step 2: Get presigned URLs for images, upload images
 * - Step 3: Get presigned URLs for documents, finalize onboarding
 * - Admin: List, approve, reject, and review venues
 */

/**
 * STEP 1: Create venue with contact info
 * POST /api/venues/onboarding/step1
 * Body: { ownerName, ownerEmail, ownerPhone }
 */
export const createVenueStep1 = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // No authentication required - public endpoint
  const venue = await startVenueOnboarding(req.body);

  // Send verification email
  const { ownerName, ownerEmail } = req.body;
  const emailResult = await sendVerificationCode(ownerEmail, ownerName);

  if (!emailResult.success) {
    throw new AppError(emailResult.message || "Failed to send verification email", 400);
  }

  const onboardingToken = generateToken({
    id: venue._id.toString(),
    email: venue.ownerEmail,
    role: "VENUE_ONBOARDING",
  });

  res.status(201).json({
    success: true,
    message: "Venue contact info saved. Verification code sent to email.",
    data: {
      venueId: venue._id,
      ownerName: venue.ownerName,
      ownerEmail: venue.ownerEmail,
      approvalStatus: venue.approvalStatus,
      nextStep: "Verify your email (check your inbox for the code)",
      token: onboardingToken,
    },
  });
});

/**
 * STEP 2: Update venue details
 * POST /api/venues/onboarding/step2
 * Body: { venueId, name, address, location, sports, pricePerHour, amenities, etc. }
 */
export const updateVenueDetailsStep2 = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    // No authentication required - public endpoint
    const { venueId } = req.body;

    if (!venueId) {
      throw new AppError("Venue ID is required", 400);
    }

    const venue = await updateVenueDetails(req.body);

    res.status(200).json({
      success: true,
      message: "Venue details saved. Proceed to Step 3: Images & Documents",
      data: {
        venueId: venue._id,
        name: venue.name,
        address: venue.address,
        approvalStatus: venue.approvalStatus,
        nextStep: "Add images (5-20) and required documents",
      },
    });
  }
);

/**
 * STEP 3A: Get presigned URLs for image upload (WAS Step 2A)
 * POST /api/venues/onboarding/step3/image-upload-urls
 *
 * Request body:
 * {
 *   venueId: string,
 *   sports: string[] (selected sports from Step 2)
 * }
 */
export const getImageUploadUrls = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { venueId, sports } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await Venue.findById(venueId);
    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    if (!sports || !Array.isArray(sports) || sports.length === 0) {
      throw new AppError("Sports array is required", 400);
    }

    const uploadUrls = await getImageUploadPresignedUrls(venueId, sports);

    const totalImages = 3 + sports.length * 5; // 3 general + 5 per sport

    res.status(200).json({
      success: true,
      message: `Upload ${totalImages} images: 3 general venue images + 5 images per sport`,
      data: {
        totalImages,
        generalImageCount: 3,
        sportsImageCount: sports.length * 5,
        sports: sports.sort(),
        maxSizePerImage: `${UPLOAD_CONSTRAINTS.IMAGES.MAX_SIZE_BYTES / (1024 * 1024)}MB`,
        uploadUrls,
      },
    });
  }
);

/**
 * Get presigned URL for coach profile photo upload
 * POST /api/venues/onboarding/coach-photo-upload-url
 * Body: { venueId, fileName, contentType }
 */
export const getCoachPhotoUploadUrl = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { venueId, fileName, contentType } = req.body;

    if (!venueId || !fileName || !contentType) {
      throw new AppError("venueId, fileName, and contentType are required", 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      throw new AppError(`Invalid content type. Allowed: ${allowedTypes.join(", ")}`, 400);
    }

    // Verify venue exists
    const venue = await Venue.findById(venueId);
    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    // Generate presigned URL using S3Service
    const s3Service = new S3Service();
    const uploadData = await s3Service.generateCoachPhotoUploadUrl(fileName, contentType, venueId);

    res.status(200).json({
      success: true,
      message: "Coach photo upload URL generated",
      data: uploadData,
    });
  }
);

/**
 * STEP 2B: Confirm images and set cover photo
 * POST /api/venues/onboarding/step2/confirm-images
 *
 * Request body:
 * {
 *   venueId: string,
 *   images: string[] (S3 URLs),
 *   coverPhotoUrl: string
 * }
 */
export const confirmImagesStep2 = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { venueId } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await Venue.findById(venueId);
    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    const updatedVenue = await confirmVenueImages(req.body);

    res.status(200).json({
      success: true,
      message: "Images confirmed. Proceed to Step 4: Add Documents",
      data: {
        venueId: updatedVenue?._id,
        imageCount: updatedVenue?.images.length,
        coverPhoto: updatedVenue?.coverPhotoUrl,
        nextStep: "Upload required documents",
      },
    });
  }
);

/**
 * STEP 3A: Get presigned URLs for document upload
 * POST /api/venues/onboarding/step3/document-upload-urls
 *
 * Request body:
 * {
 *   venueId: string,
 *   documents: [
 *     { type: string, fileName: string, contentType: string },
 *     ...
 *   ]
 * }
 */
export const getDocumentUploadUrls = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { venueId, documents } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await Venue.findById(venueId);
    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    const uploadUrls = await getDocumentUploadPresignedUrls(venueId, documents);

    res.status(200).json({
      success: true,
      message: "Upload documents to the provided URLs",
      data: {
        documentCount: documents.length,
        maxSizePerDocument: `${UPLOAD_CONSTRAINTS.DOCUMENTS.MAX_SIZE_BYTES / (1024 * 1024)}MB`,
        allowedFormats: "PDF, JPG, PNG",
        uploadUrls,
      },
    });
  }
);

/**
 * STEP 3B: Finalize onboarding with documents
 * POST /api/venues/onboarding/step3/finalize
 *
 * Request body:
 * {
 *   venueId: string,
 *   documents: [
 *     { type: string, url: string, fileName: string },
 *     ...
 *   ]
 * }
 */
export const finalizeOnboardingStep3 = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { venueId } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await Venue.findById(venueId);
    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    const updatedVenue = await finalizeVenueOnboarding(req.body);

    res.status(200).json({
      success: true,
      message: "Venue onboarding complete! Your venue is now under review.",
      data: {
        venueId: updatedVenue?._id,
        name: updatedVenue?.name,
        approvalStatus: updatedVenue?.approvalStatus,
        documentsUploaded: updatedVenue?.documents.length,
        imagesUploaded: updatedVenue?.images.length,
        nextStep: "Wait for admin approval",
      },
    });
  }
);

/**
 * Cancel/Delete venue onboarding (for incomplete venues)
 * DELETE /api/venues/onboarding/:venueId
 */
export const deleteVenueOnboardingHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const venueId = (req.params as Record<string, unknown>).venueId as string;

    // For onboarding cancellation, we allow deletion without auth
    // (user just needs to know the venueId)
    const venue = await Venue.findByIdAndDelete(venueId);

    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    // Delete associated S3 files
    const s3Service = new S3Service();
    if (venue.images?.length > 0) {
      await s3Service.deleteFiles(venue.images, "images");
    }
    if (venue.documents?.length > 0) {
      const docKeys = venue.documents.map((doc: any) => doc.url);
      await s3Service.deleteFiles(docKeys, "documents");
    }

    res.status(200).json({
      success: true,
      message: "Venue onboarding cancelled and deleted",
    });
  }
);

/**
 * ADMIN: List pending venues
 * GET /api/admin/venues/pending?page=1&limit=20&status=PENDING
 */
export const listPendingVenues = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const { page, limit } = getPaginationParams(req.query.page, req.query.limit, 20, 100);
    const status = (req.query.status as string) || undefined;

    const result = await getPendingVenues(page, limit, status as any);

    res.status(200).json({
      success: true,
      message: "Pending venues retrieved",
      data: result,
    });
  }
);

/**
 * ADMIN: Get venue onboarding details for review
 * GET /api/admin/venues/onboarding/:venueId
 */
export const getVenueOnboardingDetailsForAdmin = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const venue = await getVenueOnboardingDetails(venueId);

    if (!venue) {
      throw new AppError("Venue not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Venue details retrieved",
      data: venue,
    });
  }
);

/**
 * ADMIN: Approve venue
 * POST /api/admin/venues/onboarding/:venueId/approve
 */
export const approveVenueHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const venue = await approveVenue(venueId);

    res.status(200).json({
      success: true,
      message: "Venue approved successfully",
      data: {
        venueId: venue?._id,
        name: venue?.name,
        approvalStatus: venue?.approvalStatus,
      },
    });
  }
);

/**
 * ADMIN: Reject venue
 * POST /api/admin/venues/onboarding/:venueId/reject
 *
 * Request body:
 * { reason: string }
 */
export const rejectVenueHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      throw new AppError("Rejection reason must be at least 5 characters", 400);
    }

    const venue = await rejectVenue(venueId, reason);

    res.status(200).json({
      success: true,
      message: "Venue rejected",
      data: {
        venueId: venue?._id,
        name: venue?.name,
        approvalStatus: venue?.approvalStatus,
        rejectionReason: venue?.rejectionReason,
      },
    });
  }
);

/**
 * ADMIN: Mark venue for review
 * POST /api/admin/venues/onboarding/:venueId/mark-review
 *
 * Request body:
 * { notes?: string }
 */
export const markVenueForReviewHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id || !isAdminRole(req.user.role)) {
      throw new AppError("Admin access required", 403);
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { notes } = req.body;

    const venue = await markVenueForReview(venueId, notes);

    res.status(200).json({
      success: true,
      message: "Venue marked for review",
      data: {
        venueId: venue?._id,
        name: venue?.name,
        approvalStatus: venue?.approvalStatus,
        reviewNotes: venue?.reviewNotes,
      },
    });
  }
);

/**
 * STEP 5: Add in-house coaches to venue
 * POST /api/venues/onboarding/step5/coaches
 * Body: { venueId, coaches }
 */
export const addVenueCoaches = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { venueId, coaches } = req.body;

  if (!venueId) {
    throw new AppError("Venue ID is required", 400);
  }

  // Venue is already imported at the top

  // Update venue with coaches
  const venue = await Venue.findByIdAndUpdate(
    venueId,
    {
      hasCoaches: coaches && coaches.length > 0,
      venueCoaches: coaches || [],
    },
    { new: true, runValidators: true }
  );

  if (!venue) {
    throw new AppError("Venue not found", 404);
  }

  res.status(200).json({
    success: true,
    message: "Venue coaches saved successfully",
    data: {
      venueId: venue._id,
      hasCoaches: venue.hasCoaches,
      coachCount: venue.venueCoaches?.length || 0,
      approvalStatus: venue.approvalStatus,
      nextStep: "Onboarding completed! Awaiting admin approval.",
    },
  });
});
