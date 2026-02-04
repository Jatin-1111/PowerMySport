import { Request, Response } from "express";
import {
  createCoach,
  getCoachById,
  getCoachByUserId,
  updateCoach,
  deleteCoach,
  checkCoachAvailability,
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

    res.status(201).json({
      success: true,
      message: "Coach profile created successfully",
      data: coach,
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

    res.status(200).json({
      success: true,
      message: "Coach retrieved successfully",
      data: coach,
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

    res.status(200).json({
      success: true,
      message: "Coach profile retrieved successfully",
      data: coach,
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

    // Verify ownership
    const existingCoach = await getCoachById(coachId);
    if (!existingCoach) {
      res.status(404).json({
        success: false,
        message: "Coach not found",
      });
      return;
    }

    if (existingCoach.userId.toString() !== req.user?.id) {
      res.status(403).json({
        success: false,
        message: "You can only update your own coach profile",
      });
      return;
    }

    const coach = await updateCoach(coachId, req.body);

    res.status(200).json({
      success: true,
      message: "Coach profile updated successfully",
      data: coach,
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

    if (existingCoach.userId.toString() !== req.user?.id) {
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
