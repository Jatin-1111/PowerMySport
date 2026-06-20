import { Request, Response } from "express";
import { pathwayService } from "../services/PathwayService";

/**
 * GET /api/pathways?sport=cricket&age=12&city=Mumbai
 * Returns the pathway for a sport. Generates + caches if not found.
 * If cached but stale, returns the cached version and triggers a background refresh.
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
      isStale: result.isStale ?? false,
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

/**
 * POST /api/pathways/refresh
 * Admin: manually force-refresh a specific pathway by cacheKey.
 * Body: { cacheKey: string }
 */
export const refreshPathway = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { cacheKey } = req.body;

    if (!cacheKey || typeof cacheKey !== "string") {
      res.status(400).json({
        success: false,
        message: "cacheKey is required.",
      });
      return;
    }

    const refreshed = await pathwayService.refreshPathway(cacheKey.trim());

    if (!refreshed) {
      res.status(500).json({
        success: false,
        message: "Refresh failed — Gemini may be unavailable. Try again later.",
      });
      return;
    }

    res.json({ success: true, data: refreshed });
  } catch (error) {
    console.error("Error refreshing pathway:", error);
    res.status(500).json({ success: false, message: "Refresh failed." });
  }
};

/**
 * POST /api/pathways/refresh-stale
 * Admin: refresh all stale pathways (older than PATHWAY_STALE_DAYS env var, default 30).
 * Returns the count of pathways refreshed.
 * Runs sequentially to avoid hammering the Gemini API.
 */
export const refreshStalePathways = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const staleCacheKeys = await pathwayService.getStalePathways();

    if (staleCacheKeys.length === 0) {
      res.json({
        success: true,
        refreshed: 0,
        message: "No stale pathways found.",
      });
      return;
    }

    console.log(
      `[PathwayController] Refreshing ${staleCacheKeys.length} stale pathways...`,
    );

    // Return immediately and run refresh in background
    res.json({
      success: true,
      refreshed: staleCacheKeys.length,
      message: `Refreshing ${staleCacheKeys.length} stale pathway(s) in the background.`,
      cacheKeys: staleCacheKeys,
    });

    // Background sequential refresh (after response sent)
    (async () => {
      let count = 0;
      for (const cacheKey of staleCacheKeys) {
        await pathwayService.refreshPathway(cacheKey);
        count++;
        // Stagger to avoid Gemini rate limiting
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.log(
        `[PathwayController] ✅ Background stale refresh complete: ${count}/${staleCacheKeys.length} done.`,
      );
    })().catch((err) =>
      console.error("[PathwayController] Background refresh error:", err),
    );
  } catch (error) {
    console.error("Error refreshing stale pathways:", error);
    res.status(500).json({ success: false, message: "Stale refresh failed." });
  }
};

/**
 * GET /api/pathways/stats
 * Admin: returns aggregate stats about the pathway collection.
 */
export const getPathwayStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const stats = await pathwayService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Error fetching pathway stats:", error);
    res.status(500).json({ success: false, message: "Stats fetch failed." });
  }
};
