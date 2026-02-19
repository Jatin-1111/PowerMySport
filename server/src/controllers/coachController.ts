import { Request, Response } from "express";
import { User } from "../models/User";
import {
  checkCoachAvailability,
  createCoach,
  deleteCoach,
  getCoachById,
  getCoachByUserId,
  submitCoachVerification,
  updateCoach,
} from "../services/CoachService";

/**
 * Create a new coach profile
 * POST /api/coaches
 */
export const createNewCoach = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Validate required fields
    const { bio, certifications, sports, hourlyRate, serviceMode } = req.body;

    if (!serviceMode) {
      res.status(400).json({
        success: false,
        message: "Service mode is required",
      });
      return;
    }

    if (!sports || !Array.isArray(sports) || sports.length === 0) {
      res.status(400).json({
        success: false,
        message: "At least one sport is required",
      });
      return;
    }

    // Check if user already has a coach profile
    const existingCoach = await getCoachByUserId(req.user.id);
    if (existingCoach) {
      res.status(400).json({
        success: false,
        message: "Coach profile already exists for this user",
      });
      return;
    }

    const coach = await createCoach({
      userId: req.user.id,
      ...req.body,
    });

    console.log("Created coach:", {
      id: coach.id,
      serviceMode: coach.serviceMode,
    });

    // Convert to JSON to ensure all fields are serialized correctly
    const coachJson = coach.toJSON();

    console.log("Coach JSON response:", {
      id: coachJson.id,
      serviceMode: coachJson.serviceMode,
    });

    res.status(201).json({
      success: true,
      message: "Coach profile created successfully",
      data: coachJson,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create coach profile",
    });
  }
};

/**
 * Get coach profile by ID
 * GET /api/coaches/:coachId
 */
export const getCoach = async (req: Request, res: Response): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    const coach = await getCoachById(coachId);

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    const isPubliclyVisible =
      coach.isVerified || coach.verificationStatus === "VERIFIED";

    if (!isPubliclyVisible) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    // Convert to JSON to ensure all fields are serialized correctly
    const coachJson = coach.toJSON();

    res.status(200).json({
      success: true,
      message: "Coach retrieved successfully",
      data: coachJson,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch coach",
    });
  }
};

/**
 * Get current user's coach profile
 * GET /api/coaches/my-profile
 */
export const getMyCoachProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const coach = await getCoachByUserId(req.user.id);

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    // Convert to JSON to ensure all fields are serialized correctly
    const coachJson = coach.toJSON();

    console.log("getMyCoachProfile returning:", {
      id: coachJson.id,
      serviceMode: coachJson.serviceMode,
    });

    res.status(200).json({
      success: true,
      message: "Coach profile retrieved successfully",
      data: coachJson,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch coach profile",
    });
  }
};

/**
 * Update coach profile
 * PUT /api/coaches/:coachId
 */
export const updateCoachProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    // Validate coachId is provided and is a valid MongoDB ObjectId
    if (!coachId || coachId === "undefined") {
      res.status(400).json({
        success: false,
        message: "Invalid coach ID provided",
      });
      return;
    }

    // Verify ownership
    const existingCoach = await getCoachById(coachId);
    if (!existingCoach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    // Handle both populated userId (object) and unpopulated userId (ObjectId)
    const userId = existingCoach.userId as any;
    const coachUserId =
      typeof userId === "object" && userId !== null
        ? userId._id?.toString() || userId.id
        : userId.toString();

    if (coachUserId !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: "You can only update your own coach profile",
      });
      return;
    }

    // Handle venueId validation and preservation
    const updates = { ...req.body };
    const newServiceMode = updates.serviceMode || existingCoach.serviceMode;

    // Handle service mode specific logic
    if (newServiceMode === "OWN_VENUE") {
      // For OWN_VENUE mode: preserve existing venueId if not providing a new one
      if (!updates.venueId && existingCoach.venueId) {
        updates.venueId = existingCoach.venueId.toString();
      }
      // If no venueId is provided and coach doesn't have one, that's ok for now
      // (they can create/link venue later)
    } else {
      // For non-OWN_VENUE modes: clear venueId if coming from OWN_VENUE
      if (existingCoach.serviceMode === "OWN_VENUE" && !updates.venueId) {
        updates.venueId = null;
      }
    }

    const coach = await updateCoach(coachId, updates);

    // Convert to JSON to ensure all fields are serialized correctly
    const coachJson = coach?.toJSON();

    res.status(200).json({
      success: true,
      message: "Coach profile updated successfully",
      data: coachJson,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update coach profile",
    });
  }
};

/**
 * Delete coach profile
 * DELETE /api/coaches/:coachId
 */
export const deleteCoachProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    // Verify ownership
    const existingCoach = await getCoachById(coachId);
    if (!existingCoach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    // Handle both populated userId (object) and unpopulated userId (ObjectId)
    const userId = existingCoach.userId as any;
    const coachUserId =
      typeof userId === "object" && userId !== null
        ? userId._id?.toString() || userId.id
        : userId.toString();

    if (coachUserId !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: "You can only delete your own coach profile",
      });
      return;
    }

    await deleteCoach(coachId);

    res.status(200).json({
      success: true,
      message: "Coach profile deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete coach profile",
    });
  }
};

/**
 * Check coach availability
 * GET /api/coaches/availability/:coachId
 */
export const getCoachAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coachId = (req.params as Record<string, unknown>).coachId as string;
    const { date, startTime, endTime } = req.query;

    if (!date || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        message: "date, startTime, and endTime are required",
      });
      return;
    }

    const available = await checkCoachAvailability(
      coachId,
      new Date(date as string),
      startTime as string,
      endTime as string,
    );

    res.status(200).json({
      success: true,
      message: "Availability checked successfully",
      data: {
        available,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to check availability",
    });
  }
};

const normalizeVerificationDocuments = (
  documents?: Array<{
    type: string;
    url: string;
    s3Key?: string;
    fileName: string;
    uploadedAt?: string | Date;
  }>,
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
      ...(doc.uploadedAt
        ? { uploadedAt: new Date(doc.uploadedAt) }
        : { uploadedAt: new Date() }),
    };
  });

  const hasCertification = normalizedDocs.some(
    (doc) => doc.type === "CERTIFICATION",
  );
  const hasIdProof = normalizedDocs.some((doc) => doc.type === "ID_PROOF");

  if (!hasCertification) {
    throw new Error("A CERTIFICATION document is required");
  }

  if (!hasIdProof) {
    throw new Error("An ID_PROOF document is required");
  }

  return normalizedDocs;
};

/**
 * Save coach verification step 1 (Bio)
 * POST /api/coaches/verification/step1
 */
export const saveCoachVerificationStep1Handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({ success: false, message: "Coach role required" });
      return;
    }

    const { bio, mobileNumber } = req.body as {
      bio: string;
      mobileNumber: string;
    };

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

    const coachId = (existingCoach.id ||
      existingCoach._id?.toString()) as string;
    const coach = await updateCoach(coachId, { bio });

    res.status(200).json({
      success: true,
      message: "Step 1 saved successfully",
      data: coach,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save verification step 1",
    });
  }
};

/**
 * Save coach verification step 2 (Sports + hourly rate + core profile)
 * POST /api/coaches/verification/step2
 */
export const saveCoachVerificationStep2Handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({ success: false, message: "Coach role required" });
      return;
    }

    const {
      bio,
      sports,
      certifications,
      hourlyRate,
      sportPricing,
      serviceMode,
    } = req.body as {
      bio: string;
      sports: string[];
      certifications?: string[];
      hourlyRate: number;
      sportPricing?: Record<string, number>;
      serviceMode?: "OWN_VENUE" | "FREELANCE" | "HYBRID";
    };

    const existingCoach = await getCoachByUserId(req.user.id);

    if (existingCoach) {
      const coachId = (existingCoach.id ||
        existingCoach._id?.toString()) as string;
      const coach = await updateCoach(coachId, {
        bio,
        sports,
        certifications: certifications || [],
        hourlyRate,
        sportPricing: sportPricing || {},
      });

      res.status(200).json({
        success: true,
        message: "Step 2 saved successfully",
        data: coach,
      });
      return;
    }

    const coach = await createCoach({
      userId: req.user.id,
      bio,
      sports,
      certifications: certifications || [],
      hourlyRate,
      sportPricing: sportPricing || {},
      serviceMode: serviceMode || "FREELANCE",
      availability: [],
      ...(serviceMode !== "OWN_VENUE" && {
        serviceRadiusKm: 10,
        travelBufferTime: 30,
      }),
    });

    res.status(201).json({
      success: true,
      message: "Step 2 saved successfully",
      data: coach,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save verification step 2",
    });
  }
};

/**
 * Submit coach verification step 3 (Documents)
 * POST /api/coaches/verification/step3
 */
export const submitCoachVerificationStep3Handler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
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

    const normalizedDocs = normalizeVerificationDocuments(documents);

    const coach = await submitCoachVerification(req.user.id, {
      documents: normalizedDocs,
    });

    res.status(200).json({
      success: true,
      message: "Verification submitted successfully",
      data: coach,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to submit verification",
    });
  }
};

/**
 * Submit coach verification documents
 * POST /api/coaches/verification
 */
export const submitCoachVerificationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await submitCoachVerificationStep3Handler(req, res);
};
/**
 * Get presigned URL for coach verification document upload
 * POST /api/coaches/verification/upload-url
 */
export const getCoachVerificationUploadUrlHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (req.user.role !== "COACH") {
      res.status(403).json({
        success: false,
        message: "Coach role required",
      });
      return;
    }

    const { fileName, contentType, documentType } = req.body as {
      fileName?: string;
      contentType?: string;
      documentType?:
        | "CERTIFICATION"
        | "ID_PROOF"
        | "ADDRESS_PROOF"
        | "BACKGROUND_CHECK"
        | "INSURANCE"
        | "OTHER";
    };

    if (!fileName || !contentType || !documentType) {
      res.status(400).json({
        success: false,
        message: "fileName, contentType, and documentType are required",
      });
      return;
    }

    const coach = await getCoachByUserId(req.user.id);
    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
    }

    const { S3Service } = require("../services/S3Service");
    const s3Service = new S3Service();
    const uploadData = await s3Service.generateCoachVerificationUploadUrl(
      fileName,
      contentType,
      coach._id.toString(),
      documentType,
    );

    res.status(200).json({
      success: true,
      message: "Verification document upload URL generated",
      data: uploadData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate upload URL",
    });
  }
};
