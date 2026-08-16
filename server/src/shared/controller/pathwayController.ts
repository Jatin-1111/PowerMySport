import { Request, Response } from "express";

import { AthleteStory } from "../models/AthleteStory";
import { PathwayGuide } from "../models/PathwayGuide";
import { Tournament } from "../models/Tournament";
import { realDataScraperService } from "../services/RealDataScraperService";

// ─── Pathways (public) ───────────────────────────────────────────────────────
//
// The read side of the pathway CMS, plus two neighbours that have always lived
// on this router and depend on nothing here: athlete stories and the curated
// tournament list.
//
// Everything served here is identical for every reader of a sport — it holds no
// personal data — so it is safely cacheable at the edge.

const fail = (res: Response, error: unknown, code = 400) =>
  res.status(code).json({
    success: false,
    message: error instanceof Error ? error.message : "Request failed",
  });

const slugify = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, "-");

/** Only published guides are ever visible here — drafts stay in the CMS. */
const PUBLISHED = { status: "published" as const };

// ─── GET /api/pathways/guide?sport=tennis&state=delhi ────────────────────────
//
// A state guide wins over the national one when it exists. Asking for a state
// that has no guide of its own falls back to national rather than 404ing: the
// national guide is the right answer for most of India, and a reader who picked
// their state should not be punished for it.
export const getPathwayGuide = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const sport = req.query.sport;
    if (!sport || typeof sport !== "string" || sport.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Please provide a sport (at least 2 characters).",
      });
      return;
    }

    const sportSlug = slugify(sport);
    const stateSlug =
      typeof req.query.state === "string" && req.query.state.trim()
        ? slugify(req.query.state)
        : null;

    // One query for both candidates, then pick — cheaper than a miss-then-retry
    // round trip for the common case where no state guide exists.
    const candidates = await PathwayGuide.find({
      ...PUBLISHED,
      sportSlug,
      stateSlug: stateSlug ? { $in: [stateSlug, null] } : null,
    }).lean();

    const guide =
      candidates.find((doc) => doc.stateSlug === stateSlug) ??
      candidates.find((doc) => doc.stateSlug === null);

    if (!guide) {
      res.status(404).json({
        success: false,
        message: `No published pathway for "${sport}" yet.`,
      });
      return;
    }

    res.json({
      success: true,
      data: {
        sportSlug: guide.sportSlug,
        sportName: guide.sportName,
        stateSlug: guide.stateSlug ?? null,
        /** True when the reader asked for a state and got a state-specific guide. */
        isStateGuide: guide.stateSlug !== null,
        formatVersion: guide.formatVersion,
        intro: guide.intro ?? {},
        sportIntro: guide.sportIntro ?? [],
        reviewedOn: guide.reviewedOn ?? null,
        updatedAt: guide.updatedAt,
        stages: [...(guide.stages ?? [])].sort((a, b) => a.order - b.order),
      },
    });
  } catch (error) {
    fail(res, error, 500);
  }
};

// ─── GET /api/pathways/guides ────────────────────────────────────────────────
// Which sports have a pathway a parent can actually read. Used to build the
// sport picker without shipping every stage of every sport to do it.
export const listPublishedPathwayGuides = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const docs = await PathwayGuide.find(PUBLISHED)
      .select("sportSlug sportName stateSlug stages.key updatedAt")
      .sort({ sportName: 1 })
      .lean();

    res.json({
      success: true,
      data: docs.map((doc) => ({
        sportSlug: doc.sportSlug,
        sportName: doc.sportName,
        stateSlug: doc.stateSlug ?? null,
        stageCount: doc.stages?.length ?? 0,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    fail(res, error, 500);
  }
};

// ─── GET /api/pathways/stories?sport=cricket&level=2 ─────────────────────────
export const getPathwayStories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sport, level, state } = req.query;

    if (!sport || typeof sport !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Provide a sport parameter" });
      return;
    }

    const sportSlug = sport.toLowerCase();
    const query: Record<string, unknown> = { sportSlug };

    if (level && !isNaN(Number(level))) {
      query.level = Number(level);
    }

    // When a state is provided, filter stories to that state.
    // Also include stories with no location (national-level athletes).
    if (state && typeof state === "string" && state.trim()) {
      const stateRegex = new RegExp(`^${state.trim()}$`, "i");
      query.$or = [
        { location: stateRegex },
        { location: { $exists: false } },
        { location: "" },
      ];
    }

    const stories = await AthleteStory.find(query).sort({ level: 1 }).lean();

    // If nothing found, fire a background scrape so the next request gets results.
    if (stories.length === 0) {
      const { Sport } = await import("../models/Sport");
      const knownSport = await Sport.findOne({ slug: sportSlug })
        .select("name")
        .lean();
      const sportName = (knownSport as { name?: string } | null)?.name || sport;

      realDataScraperService
        .scrapeStoriesForSport({
          sportSlug,
          sportName,
          ...(state && typeof state === "string" ? { city: state.trim() } : {}),
        })
        .catch((err) =>
          console.error(
            "[pathwayController] Background story scrape failed:",
            err,
          ),
        );
    }

    res.json({ success: true, data: stories });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch stories" });
  }
};

// ─── GET /api/pathways/tournaments/:slug ─────────────────────────────────────
export const getCuratedTournamentBySlug = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { slug } = req.params;
    if (!slug) {
      res.status(400).json({ success: false, message: "Missing slug" });
      return;
    }

    const slugStr = (Array.isArray(slug) ? slug[0] : slug) ?? "";
    const tournament = await Tournament.findOne({
      slug: slugStr.toLowerCase().trim(),
      isCurated: true,
    }).lean();

    if (!tournament) {
      res.status(404).json({ success: false, message: "Tournament not found" });
      return;
    }

    res.json({ success: true, data: tournament });
  } catch (error) {
    fail(res, error, 500);
  }
};

// ─── GET /api/pathways/tournaments?sport=cricket ─────────────────────────────
export const getCuratedTournaments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sport } = req.query;
    const query: Record<string, unknown> = { isCurated: true };
    if (sport && typeof sport === "string") {
      query.sportSlug = slugify(sport);
    }

    const tournaments = await Tournament.find(query)
      .sort({ sportSlug: 1, prestige: 1 })
      .lean();

    res.json({ success: true, data: tournaments });
  } catch (error) {
    fail(res, error, 500);
  }
};
