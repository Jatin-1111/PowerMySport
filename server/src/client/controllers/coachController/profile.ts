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

/**
 * Create a new coach profile
 * POST /api/coaches
 */
export const createNewCoach = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to create coach profile",
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

    // Public, unauthenticated endpoint — only the fields an actual coach
    // card renders. This used to populate the entire User document
    // (including email/phone) into every response here.
    const coach = await getCoachById(coachId, {
      populateUserFields: "name photoUrl",
    });

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    const isPubliclyVisible = coach.isVerified || coach.verificationStatus === "VERIFIED";

    if (!isPubliclyVisible) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    // Convert to JSON and transform _id to id
    const coachData = transformDocument(coach.toJSON());

    res.status(200).json({
      success: true,
      message: "Coach retrieved successfully",
      data: coachData,
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
export const getMyCoachProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Self-view — matches the known-good field set already used elsewhere
    // in this service for a coach's own profile.
    const coach = await getCoachByUserId(req.user.id, {
      populateUserFields: "name photoUrl email",
    });

    if (!coach) {
      res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
      return;
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch coach profile",
    });
  }
};

/**
 * Update coach profile
 * PUT /api/coaches/:coachId
 */
export const updateCoachProfile = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update coach profile",
    });
  }
};

/**
 * Delete coach profile
 * DELETE /api/coaches/:coachId
 */
export const deleteCoachProfile = async (req: Request, res: Response): Promise<void> => {
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
      message: error instanceof Error ? error.message : "Failed to delete coach profile",
    });
  }
};
