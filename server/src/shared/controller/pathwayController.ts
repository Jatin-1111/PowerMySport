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

    const rawAge = age && typeof age === "string" ? parseInt(age, 10) : NaN;
    const childAge =
      !isNaN(rawAge) && rawAge >= 4 && rawAge <= 25 ? rawAge : undefined;
    const rawCity = city && typeof city === "string" ? city.trim() : "";
    // Strip everything except letters, spaces, hyphens, commas and dots.
    // Caps at 80 characters to prevent oversized injections.
    const childCity =
      rawCity
        .replace(/[^a-zA-Z\u0900-\u097F\s,.\-]/g, "")
        .slice(0, 80)
        .trim() || undefined;

    const result = await pathwayService.getOrGeneratePathway(
      sport.trim(),
      childAge,
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
      warnings: result.warnings,
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
