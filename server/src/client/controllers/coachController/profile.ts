import { Request, Response } from "express";
import {
  createCoach,
  deleteCoach,
  getCoachById,
  getCoachByUserId,
  updateCoach,
} from "../../services/CoachService";
import { transformDocument } from "../../../middleware/responseTransform";
import { log } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

/**
 * Create a new coach profile
 * POST /api/coaches
 */
export const createNewCoach = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }

  // Validate required fields
  const { bio, certifications, sports, hourlyRate, serviceMode } = req.body;

  if (!serviceMode) {
    throw new AppError("Service mode is required", 400);
  }

  if (!sports || !Array.isArray(sports) || sports.length === 0) {
    throw new AppError("At least one sport is required", 400);
  }

  // Check if user already has a coach profile
  const existingCoach = await getCoachByUserId(req.user.id);
  if (existingCoach) {
    throw new AppError("Coach profile already exists for this user", 400);
  }

  const {
    certifications: certBody,
    sports: sportsBody,
    sportPricing,
    serviceMode: serviceModeBody,
    ownVenueDetails,
    baseLocation,
    serviceRadiusKm,
    travelBufferTime,
    availability,
    availabilityBySport,
  } = req.body;

  const coach = await createCoach({
    userId: req.user.id,
    bio,
    certifications: certBody,
    sports: sportsBody,
    hourlyRate,
    sportPricing,
    serviceMode: serviceModeBody,
    ownVenueDetails,
    baseLocation,
    serviceRadiusKm,
    travelBufferTime,
    availability,
    availabilityBySport,
  });

  log.info("Created coach:", {
    id: coach.id,
    serviceMode: coach.serviceMode,
  });

  // Convert to JSON and transform _id to id
  const coachData = transformDocument(coach.toJSON());

  log.info("Coach JSON response:", {
    id: coachData.id,
    serviceMode: coachData.serviceMode,
  });

  res.status(201).json({
    success: true,
    message: "Coach profile created successfully",
    data: coachData,
  });
});

/**
 * Get coach profile by ID
 * GET /api/coaches/:coachId
 */
export const getCoach = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const coachId = (req.params as Record<string, unknown>).coachId as string;

  // Public, unauthenticated endpoint — only the fields an actual coach
  // card renders. This used to populate the entire User document
  // (including email/phone) into every response here.
  const coach = await getCoachById(coachId, {
    populateUserFields: "name photoUrl",
  });

  if (!coach) {
    throw new AppError("Coach not found", 404);
  }

  const isPubliclyVisible = coach.isVerified || coach.verificationStatus === "VERIFIED";

  if (!isPubliclyVisible) {
    throw new AppError("Coach not found", 404);
  }

  // Convert to JSON and transform _id to id
  const coachData = transformDocument(coach.toJSON());

  res.status(200).json({
    success: true,
    message: "Coach retrieved successfully",
    data: coachData,
  });
});

/**
 * Get current user's coach profile
 * GET /api/coaches/my-profile
 */
export const getMyCoachProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    // Self-view — matches the known-good field set already used elsewhere
    // in this service for a coach's own profile.
    const coach = await getCoachByUserId(req.user.id, {
      populateUserFields: "name photoUrl email",
    });

    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    // Convert to JSON and transform _id to id
    const coachData = transformDocument(coach.toJSON());

    log.info("getMyCoachProfile returning:", {
      id: coachData.id,
      serviceMode: coachData.serviceMode,
    });

    res.status(200).json({
      success: true,
      message: "Coach profile retrieved successfully",
      data: coachData,
    });
  }
);

/**
 * Update coach profile
 * PUT /api/coaches/:coachId
 */
export const updateCoachProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    // Validate coachId is provided and is a valid MongoDB ObjectId
    if (!coachId || coachId === "undefined") {
      throw new AppError("Invalid coach ID provided", 400);
    }

    // Verify ownership
    const existingCoach = await getCoachById(coachId);
    if (!existingCoach) {
      throw new AppError("Coach not found", 404);
    }

    // Handle both populated userId (object) and unpopulated userId (ObjectId)
    const userId = existingCoach.userId as any;
    const coachUserId =
      typeof userId === "object" && userId !== null
        ? userId._id?.toString() || userId.id
        : userId.toString();

    if (coachUserId !== req.user?.id) {
      throw new AppError("You can only update your own coach profile", 403);
    }

    // Handle ownVenueDetails validation and preservation
    const updates = { ...req.body };
    const newServiceMode = updates.serviceMode || existingCoach.serviceMode;

    // Handle service mode specific logic
    if (newServiceMode === "OWN_VENUE" || newServiceMode === "HYBRID") {
      // For OWN_VENUE/HYBRID modes: preserve existing ownVenueDetails if not providing new ones
      if (!updates.ownVenueDetails && existingCoach.ownVenueDetails) {
        updates.ownVenueDetails = existingCoach.ownVenueDetails;
      }
      // If no ownVenueDetails provided, that's ok - they can add them later
    } else if (newServiceMode === "FREELANCE") {
      // For FREELANCE mode: clear ownVenueDetails if switching from OWN_VENUE/HYBRID
      if (existingCoach.serviceMode !== "FREELANCE" && !updates.ownVenueDetails) {
        updates.ownVenueDetails = undefined;
      }
    }

    const coach = await updateCoach(coachId, updates);

    // Convert to JSON and transform _id to id
    const coachData = transformDocument(coach?.toJSON());

    res.status(200).json({
      success: true,
      message: "Coach profile updated successfully",
      data: coachData,
    });
  }
);

/**
 * Delete coach profile
 * DELETE /api/coaches/:coachId
 */
export const deleteCoachProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const coachId = (req.params as Record<string, unknown>).coachId as string;

    // Verify ownership
    const existingCoach = await getCoachById(coachId);
    if (!existingCoach) {
      throw new AppError("Coach not found", 404);
    }

    // Handle both populated userId (object) and unpopulated userId (ObjectId)
    const userId = existingCoach.userId as any;
    const coachUserId =
      typeof userId === "object" && userId !== null
        ? userId._id?.toString() || userId.id
        : userId.toString();

    if (coachUserId !== req.user?.id) {
      throw new AppError("You can only delete your own coach profile", 403);
    }

    await deleteCoach(coachId);

    res.status(200).json({
      success: true,
      message: "Coach profile deleted successfully",
    });
  }
);
