import { Request, Response } from "express";
import { sportsService } from "../services/SportsService";

/**
 * GET /api/sports
 * Get all verified sports
 */
export const getAllSports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const sports = await sportsService.getAllSports();
    res.json({
      success: true,
      data: sports,
    });
  } catch (error) {
    console.error("Error fetching sports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sports",
    });
  }
};

/**
 * GET /api/sports/search?q=cricket
 * Search sports by name
 */
export const searchSports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
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
  } catch (error) {
    console.error("Error searching sports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search sports",
    });
  }
};

/**
 * POST /api/sports/verify
 * Verify a custom sport using Gemini
 * Body: { sportName: string }
 */
export const verifySport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sportName } = req.body;

    if (!sportName || typeof sportName !== "string") {
      res.status(400).json({
        success: false,
        message: "Sport name is required",
      });
      return;
    }

    const verification = await sportsService.verifySportWithGemini(
      sportName.trim(),
    );

    res.json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error("Error verifying sport:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify sport",
    });
  }
};

/**
 * POST /api/sports/add
 * Add a custom sport after verification
 * Body: { sportName: string }
 * Requires authentication
 */
export const addCustomSport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sportName } = req.body;
    const userId = (req as any).user?.id;

    if (!sportName || typeof sportName !== "string") {
      res.status(400).json({
        success: false,
        message: "Sport name is required",
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // First verify the sport
    const verification = await sportsService.verifySportWithGemini(
      sportName.trim(),
    );

    if (!verification.isValid) {
      res.status(400).json({
        success: false,
        message: verification.message,
      });
      return;
    }

    // Add the sport
    const sport = await sportsService.addCustomSport(
      sportName.trim(),
      userId,
      true,
    );

    res.json({
      success: true,
      message: "Sport added successfully",
      data: sport,
    });
  } catch (error) {
    console.error("Error adding custom sport:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add custom sport",
    });
  }
};
