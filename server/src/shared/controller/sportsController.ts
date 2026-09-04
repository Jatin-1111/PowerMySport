import { Request, Response } from "express";
import { sportsService } from "../services/SportsService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

/**
 * GET /api/sports
 * Get all verified sports
 */
export const getAllSports = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sports = await sportsService.getAllSports();
  res.json({
    success: true,
    data: sports,
  });
});

/**
 * GET /api/sports/search?q=cricket
 * Search sports by name
 */
export const searchSports = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { q } = req.query;

  if (!q || typeof q !== "string" || q.trim().length === 0) {
    // Return all sports if no query
    const sports = await sportsService.getAllSports();
    res.json({
      success: true,
      data: sports,
    });
    return;
  }

  const sports = await sportsService.searchSports(q.trim());
  res.json({
    success: true,
    data: sports,
  });
});

/**
 * POST /api/sports/verify
 * Verify a custom sport using Gemini
 * Body: { sportName: string }
 */
export const verifySport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sportName } = req.body;

  if (!sportName || typeof sportName !== "string") {
    throw new AppError("Sport name is required", 400);
  }

  const verification = await sportsService.verifySportWithGemini(sportName.trim());

  res.json({
    success: true,
    data: verification,
  });
});

/**
 * POST /api/sports/add
 * Add a custom sport after verification
 * Body: { sportName: string }
 * Requires authentication
 */
export const addCustomSport = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sportName } = req.body;
  const userId = (req as any).user?.id;

  if (!sportName || typeof sportName !== "string") {
    throw new AppError("Sport name is required", 400);
  }

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  // First verify the sport
  const verification = await sportsService.verifySportWithGemini(sportName.trim());

  if (!verification.isValid) {
    throw new AppError(verification.message, 400);
  }

  // Add the sport
  const sport = await sportsService.addCustomSport(sportName.trim(), userId, true);

  res.json({
    success: true,
    message: "Sport added successfully",
    data: sport,
  });
});
