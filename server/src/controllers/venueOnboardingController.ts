import { Request, Response } from "express";
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
  UPLOAD_CONSTRAINTS,
} from "../services/VenueOnboardingService";

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
export const createVenueStep1 = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // No authentication required - public endpoint
    const venue = await startVenueOnboarding(req.body);

    res.status(201).json({
      success: true,
      message: "Venue contact info saved. Proceed to Step 2: Venue Details",
      data: {
        venueId: venue._id,
        ownerName: venue.ownerName,
        ownerEmail: venue.ownerEmail,
        approvalStatus: venue.approvalStatus,
        nextStep: "Fill in venue details (name, location, sports, etc.)",
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create venue",
    });
  }
};

/**
 * STEP 2: Update venue details
 * POST /api/venues/onboarding/step2
 * Body: { venueId, name, address, location, sports, pricePerHour, amenities, etc. }
 */
export const updateVenueDetailsStep2 = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // No authentication required - public endpoint
    const { venueId } = req.body;

    if (!venueId) {
      res.status(400).json({
        success: false,
        message: "Venue ID is required",
      });
      return;
    }

    const {
      updateVenueDetails,
    } = require("../services/VenueOnboardingService");
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update venue details",
    });
  }
};

/**
 * STEP 3A: Get presigned URLs for image upload (WAS Step 2A)
 * POST /api/venues/onboarding/step3/image-upload-urls
 *
 * Request body:
 * {
 *   venueId: string,
 *   imageCount: number (5-20),
 *   coverPhotoIndex: number (index of cover photo)
 * }
 */
export const getImageUploadUrls = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { venueId, imageCount, coverPhotoIndex } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await require("../models/Venue").Venue.findById(venueId);
    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    const uploadUrls = await getImageUploadPresignedUrls(
      venueId,
      imageCount,
      coverPhotoIndex,
    );

    res.status(200).json({
      success: true,
      message: `Upload ${imageCount} images to the provided URLs`,
      data: {
        totalImages: imageCount,
        coverPhotoIndex,
        maxSizePerImage: `${UPLOAD_CONSTRAINTS.IMAGES.MAX_SIZE_BYTES / (1024 * 1024)}MB`,
        uploadUrls,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate upload URLs",
    });
  }
};

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
export const confirmImagesStep2 = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { venueId } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await require("../models/Venue").Venue.findById(venueId);
    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to confirm images",
    });
  }
};

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
export const getDocumentUploadUrls = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { venueId, documents } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await require("../models/Venue").Venue.findById(venueId);
    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate document upload URLs",
    });
  }
};

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
export const finalizeOnboardingStep3 = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { venueId } = req.body;

    // Verify venue exists (no auth required - public onboarding)
    const venue = await require("../models/Venue").Venue.findById(venueId);
    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to finalize onboarding",
    });
  }
};

/**
 * Cancel/Delete venue onboarding (for incomplete venues)
 * DELETE /api/venues/onboarding/:venueId
 */
export const deleteVenueOnboardingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const venueId = (req.params as Record<string, unknown>).venueId as string;

    // For onboarding cancellation, we allow deletion without auth
    // (user just needs to know the venueId)
    const venue =
      await require("../models/Venue").Venue.findByIdAndDelete(venueId);

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    // Delete associated S3 files
    const { s3Service } = await import("../services/S3Service.js");
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete venue",
    });
  }
};

/**
 * ADMIN: List pending venues
 * GET /api/admin/venues/pending?page=1&limit=20&status=PENDING
 */
export const listPendingVenues = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const status = (req.query.status as string) || undefined;

    const result = await getPendingVenues(page, limit, status as any);

    res.status(200).json({
      success: true,
      message: "Pending venues retrieved",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch pending venues",
    });
  }
};

/**
 * ADMIN: Get venue onboarding details for review
 * GET /api/admin/venues/onboarding/:venueId
 */
export const getVenueOnboardingDetailsForAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const venue = await getVenueOnboardingDetails(venueId);

    if (!venue) {
      res.status(404).json({
        success: false,
        message: "Venue not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Venue details retrieved",
      data: venue,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch venue details",
    });
  }
};

/**
 * ADMIN: Approve venue
 * POST /api/admin/venues/onboarding/:venueId/approve
 */
export const approveVenueHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to approve venue",
    });
  }
};

/**
 * ADMIN: Reject venue
 * POST /api/admin/venues/onboarding/:venueId/reject
 *
 * Request body:
 * { reason: string }
 */
export const rejectVenueHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
    }

    const venueId = (req.params as Record<string, unknown>).venueId as string;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      res.status(400).json({
        success: false,
        message: "Rejection reason must be at least 5 characters",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to reject venue",
    });
  }
};

/**
 * ADMIN: Mark venue for review
 * POST /api/admin/venues/onboarding/:venueId/mark-review
 *
 * Request body:
 * { notes?: string }
 */
export const markVenueForReviewHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id || req.user.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        message: "Admin access required",
      });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to mark venue for review",
    });
  }
};
