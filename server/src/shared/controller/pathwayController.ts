import { Request, Response } from "express";

import { AthleteStory } from "../models/AthleteStory";
import { PathwayGuide } from "../models/PathwayGuide";
import { Tournament } from "../models/Tournament";
import { realDataScraperService } from "../services/RealDataScraperService";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("pathway");

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

const slugify = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, "-");

/** Only published guides are ever visible here — drafts stay in the CMS. */
const PUBLISHED = { status: "published" as const };

// ─── GET /api/pathways/guide?sport=tennis ────────────────────────────────────
//
// One guide per sport. This used to take a `?state=` overlay that won over the
// national guide; removed Aug 2026 along with the rest of the state dimension.
export const getPathwayGuide = async (req: Request, res: Response): Promise<void> => {
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

    const guide = await PathwayGuide.findOne({
      ...PUBLISHED,
      sportSlug,
    }).lean();

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
//
// Which sports have a pathway a parent can actually read.
//
// The projection carries each stage's name and age range as well as its key. It
// used to carry the key alone, and the picker counted them — which meant the
// index could say "Tennis, 6 stages" and nothing more, so every visitor entered
// at stage one no matter how old their child is.
//
// Adding two short strings per stage is what lets the picker point a parent at
// the right stage, and it stays one request no matter how many sports are
// published: fifty sports of six stages is on the order of fifteen kilobytes,
// against fifty round-trips for the same information a document at a time.
// Everything long — overviews, questions, answers — is still only in the
// per-sport endpoint.
export const listPublishedPathwayGuides = async (_req: Request, res: Response): Promise<void> => {
  try {
    const docs = await PathwayGuide.find(PUBLISHED)
      .select(
        "sportSlug sportName stages.key stages.name stages.ageRange stages.coreQuestion stages.order updatedAt"
      )
      .sort({ sportName: 1 })
      .lean();

    res.json({
      success: true,
      data: docs.map((doc) => {
        // Sorted here, like the single-guide endpoint does. Mongo returns the
        // stages in stored order, and the CMS reorders by rewriting `order`.
        const stages = [...(doc.stages ?? [])].sort((a, b) => a.order - b.order);
        return {
          sportSlug: doc.sportSlug,
          sportName: doc.sportName,
          stageCount: stages.length,
          stages: stages.map((stage) => ({
            key: stage.key,
            name: stage.name,
            ageRange: stage.ageRange,
            coreQuestion: stage.coreQuestion,
          })),
          updatedAt: doc.updatedAt,
        };
      }),
    });
  } catch (error) {
    fail(res, error, 500);
  }
};

// ─── GET /api/pathways/questions ─────────────────────────────────────────────
//
// Every answered parent question across every published pathway, flattened, for
// the preview band on `/roadmap`.
//
// An aggregation rather than reading the guides and picking through them. The
// index needs a handful of questions drawn from ALL published sports, and the
// obvious implementation — fetch each guide, keep two, throw the rest away —
// costs one request and one full document per sport. That is the thing this page
// was just rebuilt to stop doing.
//
// The pipeline keeps only the question text — never the answer, which is the
// long field and lives on the sport's own page.
//
// The per-sport cap bounds the PAYLOAD, not the mix. It is tempting to set it to
// two or three to force variety, and that is the wrong lever: the caller
// interleaves one question per sport at a time, so breadth is already
// guaranteed, and a low cap only starves the band while few sports have their
// answers written. Eight is high enough for one sport to fill the band on its
// own today and still bounds a fifty-sport response to a few tens of kilobytes.
const MAX_QUESTIONS_PER_SPORT = 8;

export const listPathwayQuestions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rows = await PathwayGuide.aggregate([
      { $match: PUBLISHED },
      { $unwind: "$stages" },
      { $sort: { sportName: 1, "stages.order": 1 } },
      { $unwind: "$stages.questions" },
      // Unanswered questions are listed in the CMS before they are written. The
      // band's promise is "open one and you land on the answer", so a question
      // with nothing behind it must never reach it.
      {
        $match: {
          "stages.questions.answer": { $exists: true, $nin: [null, ""] },
        },
      },
      {
        $group: {
          _id: "$sportSlug",
          sportName: { $first: "$sportName" },
          questions: {
            $push: {
              question: "$stages.questions.question",
              stageKey: "$stages.key",
              stageName: "$stages.name",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          sportSlug: "$_id",
          sportName: 1,
          questions: { $slice: ["$questions", MAX_QUESTIONS_PER_SPORT] },
        },
      },
      { $sort: { sportName: 1 } },
    ]);

    res.json({ success: true, data: rows });
  } catch (error) {
    fail(res, error, 500);
  }
};

// ─── GET /api/pathways/stories?sport=cricket&level=2 ─────────────────────────
export const getPathwayStories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sport, level, state } = req.query;

    if (!sport || typeof sport !== "string") {
      res.status(400).json({ success: false, message: "Provide a sport parameter" });
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
      query.$or = [{ location: stateRegex }, { location: { $exists: false } }, { location: "" }];
    }

    const stories = await AthleteStory.find(query).sort({ level: 1 }).lean();

    // If nothing found, fire a background scrape so the next request gets results.
    if (stories.length === 0) {
      const { Sport } = await import("../models/Sport");
      const knownSport = await Sport.findOne({ slug: sportSlug }).select("name").lean();
      const sportName = (knownSport as { name?: string } | null)?.name || sport;

      realDataScraperService
        .scrapeStoriesForSport({
          sportSlug,
          sportName,
          ...(state && typeof state === "string" ? { city: state.trim() } : {}),
        })
        .catch((err) => log.error("[pathwayController] Background story scrape failed:", err));
    }

    res.json({ success: true, data: stories });
  } catch {
    res.status(500).json({ success: false, message: "Failed to fetch stories" });
  }
};

// ─── GET /api/pathways/tournaments/:slug ─────────────────────────────────────
export const getCuratedTournamentBySlug = async (req: Request, res: Response): Promise<void> => {
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
export const getCuratedTournaments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sport } = req.query;
    const query: Record<string, unknown> = { isCurated: true };
    if (sport && typeof sport === "string") {
      query.sportSlug = slugify(sport);
    }

    const tournaments = await Tournament.find(query).sort({ sportSlug: 1, prestige: 1 }).lean();

    res.json({ success: true, data: tournaments });
  } catch (error) {
    fail(res, error, 500);
  }
};
