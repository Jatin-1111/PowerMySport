import { Request, Response } from "express";
import { pathwayService } from "../services/PathwayService";
import { AthleteStory } from "../models/AthleteStory";
import { INDIAN_STATES_AND_UTS } from "../utils/states";
import { PathwayExpertVerification } from "../models/PathwayExpertVerification";
import {
  listPathwaysForExpertVerification,
  verifyPathwayAsExpert,
  removePathwayExpertVerification,
} from "../services/PathwayExpertVerificationService";

const fail = (res: Response, error: unknown, code = 400) =>
  res.status(code).json({
    success: false,
    message: error instanceof Error ? error.message : "Request failed",
  });

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
    const { sport, state } = req.query;

    if (!sport || typeof sport !== "string" || sport.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Please provide a sport name (at least 2 characters).",
      });
      return;
    }

    if (!state || typeof state !== "string" || !INDIAN_STATES_AND_UTS.includes(state as any)) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid Indian state or UT.",
      });
      return;
    }

    const result = await pathwayService.getOrGeneratePathway(
      sport.trim(),
      state,
    );

    if (result.source === "not_a_sport") {
      res.status(404).json({
        success: false,
        message: result.message,
      });
      return;
    }

    // Expert verification is sport-wide (not per state-variant document), so
    // it's attached here at read time rather than stored on the pathway doc.
    let data: unknown = result.pathway;
    if (result.pathway) {
      const expertVerifications = await PathwayExpertVerification.find({
        sportSlug: result.pathway.sportSlug,
      })
        .select("expertId expertName expertPhotoUrl verifiedAt note -_id")
        .sort({ verifiedAt: -1 })
        .lean();
      data = {
        ...(typeof (result.pathway as any).toObject === "function"
          ? (result.pathway as any).toObject()
          : result.pathway),
        expertVerifications,
      };
    }

    res.json({
      success: true,
      source: result.source, // "db" | "generated"
      isStale: result.isStale ?? false,
      entitiesReady: result.entitiesReady ?? true,
      data,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error("Error fetching pathway:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while generating the pathway.",
    });
  }
};

/**
 * GET /api/pathways/entities?sport=cricket&city=Mumbai
 * Returns just tournaments/scholarships/universities for a sport.
 * Triggers the scraper and waits for it if entities aren't cached yet.
 * Called in parallel with the skeleton request from the client.
 */
export const getPathwayEntities = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sport, state } = req.query;
    if (!sport || typeof sport !== "string" || sport.trim().length < 2) {
      res.status(400).json({ success: false, message: "Provide a sport name." });
      return;
    }
    if (!state || typeof state !== "string" || !INDIAN_STATES_AND_UTS.includes(state as any)) {
      res.status(400).json({ success: false, message: "Provide a valid Indian state or UT." });
      return;
    }
    const entities = await pathwayService.getEntities(sport.trim(), state);
    res.json({ success: true, data: entities });
  } catch (error) {
    console.error("Error fetching pathway entities:", error);
    res.status(500).json({ success: false, message: "Failed to fetch entities." });
  }
};

export const getPathwayStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sport, level } = req.query;
    if (!sport || typeof sport !== "string") {
      res.status(400).json({ success: false, message: "Provide a sport parameter" });
      return;
    }
    const query: any = { sportSlug: sport.toLowerCase() };
    if (level && !isNaN(Number(level))) {
      query.level = Number(level);
    }
    const stories = await AthleteStory.find(query).lean();
    res.json({ success: true, data: stories });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch stories" });
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

/**
 * GET /api/pathways/expert/mine
 * Expert-only: pathways matching sports on the logged-in expert's profile,
 * so they only ever see (and can verify) content in their own domain.
 */
export const getPathwaysForExpertVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const data = await listPathwaysForExpertVerification(req.user.id);
    res.json({ success: true, message: "Pathways retrieved", data });
  } catch (error) {
    fail(res, error, 404);
  }
};

/**
 * POST /api/pathways/expert/:sportSlug/verify
 * Expert-only: adds (or updates) this expert's named verification credit for
 * a sport. Applies to every state variant of that sport's pathway — rejected
 * server-side if the sport isn't on the expert's own profile.
 */
export const postPathwayExpertVerify = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const verification = await verifyPathwayAsExpert(
      req.params.sportSlug as string,
      req.user.id,
      typeof req.body?.note === "string" ? req.body.note : undefined,
    );
    res.json({ success: true, message: "Pathway verified", data: verification });
  } catch (error) {
    fail(res, error);
  }
};

/**
 * DELETE /api/pathways/expert/:sportSlug/verify
 * Expert-only: removes this expert's own verification credit for a sport.
 */
export const deletePathwayExpertVerify = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    await removePathwayExpertVerification(
      req.params.sportSlug as string,
      req.user.id,
    );
    res.json({ success: true, message: "Verification removed" });
  } catch (error) {
    fail(res, error);
  }
};
