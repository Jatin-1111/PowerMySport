import { Request, Response } from "express";
import { pathwayService } from "../services/PathwayService";

/**
 * GET /api/pathways?sport=cricket
 * Returns the pathway for a sport. Generates + caches if not found.
 */
export const getPathway = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sport, age, city } = req.query;

    if (!sport || typeof sport !== "string" || sport.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Please provide a sport name (at least 2 characters).",
      });
      return;
    }

    const childAge =
      age && typeof age === "string" ? parseInt(age, 10) : undefined;
    const childCity =
      city && typeof city === "string" ? city.trim() : undefined;

    const result = await pathwayService.getOrGeneratePathway(
      sport.trim(),
      !isNaN(childAge as number) ? childAge : undefined,
      childCity,
    );

    if (result.source === "not_a_sport") {
      res.status(404).json({
        success: false,
        message: result.message,
      });
      return;
    }

    res.json({
      success: true,
      source: result.source, // "db" | "generated"
      data: result.pathway,
    });
  } catch (error) {
    console.error("Error fetching pathway:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate pathway. Please try again.",
    });
  }
};

/**
 * GET /api/pathways/search?q=bad
 * Autocomplete: returns cached pathways matching the query.
 */
export const searchPathways = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await pathwayService.searchPathways(q.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    console.error("Error searching pathways:", error);
    res.status(500).json({ success: false, message: "Search failed." });
  }
};
