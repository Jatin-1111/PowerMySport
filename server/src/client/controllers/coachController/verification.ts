import { Request, Response, NextFunction } from "express";
import { S3Service } from "../../../shared/services/S3Service";
import { User } from "../../models/User";
import {
  createCoach,
  getCoachByUserId,
  submitCoachVerification,
  updateCoach,
} from "../../services/CoachService";
import { transformDocument } from "../../../middleware/responseTransform";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

const normalizeVerificationDocuments = (
  documents?: Array<{
    type: string;
    url: string;
    s3Key?: string;
    fileName: string;
    uploadedAt?: string | Date;
  }>
) => {
  const allowedTypes = [
    "CERTIFICATION",
    "ID_PROOF",
    "ADDRESS_PROOF",
    "BACKGROUND_CHECK",
    "INSURANCE",
    "OTHER",
  ] as const;

  const normalizedDocs = (documents || []).map((doc) => {
    if (!allowedTypes.includes(doc.type as (typeof allowedTypes)[number])) {
      throw new Error("Invalid document type");
    }
    if (!doc.url || !doc.fileName) {
      throw new Error("Document url and fileName are required");
    }

    return {
      type: doc.type as (typeof allowedTypes)[number],
      url: doc.url,
      fileName: doc.fileName,
      ...(doc.s3Key ? { s3Key: doc.s3Key } : {}),
      ...(doc.uploadedAt ? { uploadedAt: new Date(doc.uploadedAt) } : { uploadedAt: new Date() }),
    };
  });

  return normalizedDocs;
};

const hasValidBio = (bio?: string) => Boolean(bio && bio.trim().length > 0);

const hasValidMobileNumber = (mobileNumber?: string) => {
  if (!mobileNumber || !mobileNumber.trim()) {
    return false;
  }

  return /^[+]?[0-9\s().\-]+$/.test(mobileNumber.trim());
};

const hasCoordinates = (coordinates?: unknown): coordinates is [number, number] => {
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    Number.isFinite(Number(coordinates[0])) &&
    Number.isFinite(Number(coordinates[1]))
  );
};

const hasStep1Completed = async (userId: string, bioCandidate?: string) => {
  const [existingUser, existingCoach] = await Promise.all([
    User.findById(userId).select("phone photoUrl"),
    getCoachByUserId(userId),
  ]);

  const phoneFromUser = existingUser?.phone;
  const photoFromUser = existingUser?.photoUrl;
  const bioFromCoach = existingCoach?.bio;

  return (
    Boolean(photoFromUser?.trim()) &&
    hasValidMobileNumber(phoneFromUser) &&
    hasValidBio(bioCandidate || bioFromCoach)
  );
};

/**
 * Save coach verification step 1 (Bio)
 * POST /api/coaches/verification/step1
 */
export const saveCoachVerificationStep1Handler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    if (req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const { bio, mobileNumber } = req.body as {
      bio: string;
      mobileNumber: string;
    };

    if (!hasValidBio(bio)) {
      throw new AppError("Bio is required to complete step 1", 400);
    }

    if (!hasValidMobileNumber(mobileNumber)) {
      throw new AppError("A valid mobile number is required to complete step 1", 400);
    }

    const user = await User.findById(req.user.id).select("photoUrl");
    if (!user?.photoUrl?.trim()) {
      throw new AppError("Profile picture is required before continuing", 400);
    }

    await User.findByIdAndUpdate(req.user.id, { phone: mobileNumber });

    const existingCoach = await getCoachByUserId(req.user.id);

    if (!existingCoach) {
      res.status(200).json({
        success: true,
        message: "Step 1 captured. Continue to step 2.",
        data: { bio, mobileNumber },
      });
      return;
    }

    const coachId = (existingCoach.id || existingCoach._id?.toString()) as string;
    const coach = await updateCoach(coachId, {
      bio,
      onboardingProgressStep: Math.max(Number(existingCoach.onboardingProgressStep || 1), 1) as
        1 | 2 | 3,
    });

    const coachData = transformDocument(coach?.toJSON());

    res.status(200).json({
      success: true,
      message: "Step 1 saved successfully",
      data: coachData,
    });
  }
);

/**
 * Save coach verification step 2 (Sports + hourly rate + core profile)
 * POST /api/coaches/verification/step2
 */
export const saveCoachVerificationStep2Handler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    if (req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const {
      bio,
      sports,
      certifications,
      hourlyRate,
      sportPricing,
      serviceMode,
      baseLocation,
      serviceRadiusKm,
      travelBufferTime,
      ownVenueDetails,
    } = req.body as {
      bio: string;
      sports: string[];
      certifications?: string[];
      hourlyRate: number;
      sportPricing?: Record<string, number>;
      serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
      baseLocation?: {
        type: "Point";
        coordinates: [number, number];
      };
      serviceRadiusKm?: number;
      travelBufferTime?: number;
      ownVenueDetails?: {
        name: string;
        address: string;
        description?: string;
        openingHours?: string;
        images?: string[];
        imageS3Keys?: string[];
        coordinates?: [number, number];
        location?: {
          type: string;
          coordinates: [number, number];
        };
      };
    };

    const step1Completed = await hasStep1Completed(req.user.id, bio);
    if (!step1Completed) {
      throw new AppError(
        "Complete step 1 first: profile picture, bio, and valid mobile number are required",
        400
      );
    }

    if (!Array.isArray(sports) || sports.length === 0) {
      throw new AppError("At least one sport is required to complete step 2", 400);
    }

    if (!Number.isFinite(Number(hourlyRate)) || Number(hourlyRate) <= 0) {
      throw new AppError("A valid hourly rate greater than 0 is required", 400);
    }

    if (serviceMode !== "OWN_VENUE" && serviceMode !== "FREELANCE" && serviceMode !== "HYBRID") {
      throw new AppError("A valid service mode is required for step 2", 400);
    }

    const effectiveServiceMode = serviceMode;

    if (effectiveServiceMode === "OWN_VENUE" || effectiveServiceMode === "HYBRID") {
      if (!ownVenueDetails?.name?.trim() || !ownVenueDetails?.address?.trim()) {
        throw new AppError("Venue name and address are required for OWN_VENUE or HYBRID mode", 400);
      }

      const ownVenueCoordinates =
        ownVenueDetails.location?.coordinates || ownVenueDetails.coordinates;
      if (!hasCoordinates(ownVenueCoordinates)) {
        throw new AppError("Venue coordinates are required for OWN_VENUE or HYBRID mode", 400);
      }
    }

    if (effectiveServiceMode !== "OWN_VENUE") {
      if (!hasCoordinates(baseLocation?.coordinates)) {
        throw new AppError(
          "Base location coordinates are required for FREELANCE or HYBRID mode",
          400
        );
      }

      if (!Number.isFinite(Number(serviceRadiusKm)) || Number(serviceRadiusKm) <= 0) {
        throw new AppError("Service radius must be a valid number greater than 0", 400);
      }

      if (!Number.isFinite(Number(travelBufferTime)) || Number(travelBufferTime) < 0) {
        throw new AppError("Travel buffer time must be a valid non-negative number", 400);
      }
    }

    // Build venue details for coach if provided
    let venueDetailsPayload;
    if (ownVenueDetails && (serviceMode === "OWN_VENUE" || serviceMode === "HYBRID")) {
      // Validate that coordinates exist
      const coordinates = ownVenueDetails.location?.coordinates || ownVenueDetails.coordinates;

      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new AppError("Venue coordinates are required and must be [longitude, latitude]", 400);
      }

      // Pass through the ownVenueDetails as-is, ensuring coordinates are at the right level
      venueDetailsPayload = {
        name: ownVenueDetails.name,
        address: ownVenueDetails.address,
        location: {
          type: "Point",
          coordinates: [Number(coordinates[0]), Number(coordinates[1])],
        },
        sports,
        amenities: [],
        pricePerHour: hourlyRate,
        description: ownVenueDetails.description || "",
        images: ownVenueDetails.images || [],
        imageS3Keys: ownVenueDetails.imageS3Keys || [],
        openingHours: ownVenueDetails.openingHours || "09:00-18:00",
      };
    }

    const existingCoach = await getCoachByUserId(req.user.id);

    if (existingCoach) {
      const coachId = (existingCoach.id || existingCoach._id?.toString()) as string;
      const updatePayload: any = {
        bio,
        sports,
        certifications: certifications || [],
        hourlyRate,
        sportPricing: sportPricing || {},
        serviceMode: serviceMode || existingCoach.serviceMode || "FREELANCE",
        onboardingProgressStep: Math.max(Number(existingCoach.onboardingProgressStep || 1), 2) as
          1 | 2 | 3,
      };

      if (baseLocation) {
        updatePayload.baseLocation = {
          type: "Point",
          coordinates: [Number(baseLocation.coordinates[0]), Number(baseLocation.coordinates[1])],
        };
      }

      if (serviceMode !== "OWN_VENUE") {
        updatePayload.serviceRadiusKm = serviceRadiusKm || 10;
        updatePayload.travelBufferTime = travelBufferTime || 30;
      }

      if (venueDetailsPayload) {
        updatePayload.ownVenueDetails = venueDetailsPayload;
      }

      const coach = await updateCoach(coachId, updatePayload);

      const coachData = transformDocument(coach?.toJSON());

      res.status(200).json({
        success: true,
        message: "Step 2 saved successfully",
        data: coachData,
      });
      return;
    }

    const createPayload: any = {
      userId: req.user.id,
      bio,
      sports,
      certifications: certifications || [],
      hourlyRate,
      sportPricing: sportPricing || {},
      serviceMode: serviceMode || "FREELANCE",
      onboardingProgressStep: 2,
      availability: [],
      ...(serviceMode !== "OWN_VENUE" && {
        serviceRadiusKm: serviceRadiusKm || 10,
        travelBufferTime: travelBufferTime || 30,
      }),
    };

    if (baseLocation) {
      createPayload.baseLocation = {
        type: "Point",
        coordinates: [Number(baseLocation.coordinates[0]), Number(baseLocation.coordinates[1])],
      };
    }

    if (venueDetailsPayload) {
      createPayload.ownVenueDetails = venueDetailsPayload;
    }

    const coach = await createCoach(createPayload);

    const coachData = transformDocument(coach.toJSON());

    res.status(201).json({
      success: true,
      message: "Step 2 saved successfully",
      data: coachData,
    });
  }
);

/**
 * Submit coach verification step 3 (Documents)
 * POST /api/coaches/verification/step3
 */
export const submitCoachVerificationStep3Handler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    if (req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const { documents } = req.body as {
      documents?: Array<{
        type: string;
        url: string;
        s3Key?: string;
        fileName: string;
        uploadedAt?: string;
      }>;
    };

    const existingCoach = await getCoachByUserId(req.user.id);
    if (!existingCoach) {
      throw new AppError("Complete step 2 before submitting verification", 400);
    }

    const step1Completed = await hasStep1Completed(req.user.id, existingCoach.bio);
    if (!step1Completed) {
      throw new AppError(
        "Step 1 is incomplete. Add profile picture, bio, and mobile number first",
        400
      );
    }

    if (!Array.isArray(existingCoach.sports) || existingCoach.sports.length === 0) {
      throw new AppError(
        "Step 2 is incomplete. Add at least one sport and pricing before submitting",
        400
      );
    }

    if (
      !Number.isFinite(Number(existingCoach.hourlyRate)) ||
      Number(existingCoach.hourlyRate) <= 0
    ) {
      throw new AppError("Step 2 is incomplete. Add a valid hourly rate before submitting", 400);
    }

    const normalizedDocs = normalizeVerificationDocuments(documents);

    const coach = await submitCoachVerification(req.user.id, {
      documents: normalizedDocs,
    });

    const coachData = transformDocument(coach?.toJSON());

    res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      data: coachData,
    });
  }
);

/**
 * Submit coach verification documents
 * POST /api/coaches/verification
 */
export const submitCoachVerificationHandler = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await submitCoachVerificationStep3Handler(req, res, next);
  }
);

/**
 * Get presigned URL for coach verification document upload
 * POST /api/coaches/verification/upload-url
 */
export const getCoachVerificationUploadUrlHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    if (req.user.role !== "Coach") {
      throw new AppError("Coach role required", 403);
    }

    const { fileName, contentType, documentType, purpose } = req.body as {
      fileName?: string;
      contentType?: string;
      documentType?:
        "CERTIFICATION" | "ID_PROOF" | "ADDRESS_PROOF" | "BACKGROUND_CHECK" | "INSURANCE" | "OTHER";
      purpose?: "DOCUMENT" | "VENUE_IMAGE";
    };

    if (!fileName || !contentType || !documentType) {
      throw new AppError("fileName, contentType, and documentType are required", 400);
    }

    const allowedDocumentTypes = ["application/pdf", "image/jpeg", "image/png"];
    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

    const allowedTypes = purpose === "VENUE_IMAGE" ? allowedImageTypes : allowedDocumentTypes;
    if (!allowedTypes.includes(contentType)) {
      throw new AppError(`Invalid content type. Allowed: ${allowedTypes.join(", ")}`, 400);
    }

    const coach = await getCoachByUserId(req.user.id);
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const s3Service = new S3Service();
    const uploadData =
      purpose === "VENUE_IMAGE"
        ? await s3Service.generateCoachVenueImageUploadUrl(
            fileName,
            contentType,
            coach._id.toString()
          )
        : await s3Service.generateCoachVerificationUploadUrl(
            fileName,
            contentType,
            coach._id.toString(),
            documentType
          );

    res.status(200).json({
      success: true,
      message:
        purpose === "VENUE_IMAGE"
          ? "Venue image upload URL generated"
          : "Verification document upload URL generated",
      data: uploadData,
    });
  }
);
