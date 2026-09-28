import { Request, Response } from "express";

import { Opportunity } from "../models/Opportunity";
import {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_TRACKS,
  cycleStateOf,
  isStale,
  todayInIndia,
  type CycleState,
  type OpportunityTrack,
} from "../validation/opportunityFormat";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

// ─── Public reads for /admissions and /scholarships ─────────────────────────
//
// Published records only. Whether a window is open, and whether a record is
// overdue a re-check, are worked out here on every read rather than stored, so
// a closed window can never be shown as open because a job did not run.

/** Open windows first: those are the ones a parent can still act on this year. */
const CYCLE_ORDER: Record<CycleState, number> = { open: 0, upcoming: 1, rolling: 2, closed: 3 };

const LIST_FIELDS =
  "slug track category title summary owner sports allSports geography selection benefit " +
  "cycle lastVerifiedOn";

const isTrack = (value: unknown): value is OpportunityTrack =>
  typeof value === "string" && (OPPORTUNITY_TRACKS as readonly string[]).includes(value);

const withState = <T extends { cycle?: object | null; lastVerifiedOn?: string | null }>(
  doc: T,
  today: string
) => ({
  ...doc,
  cycleState: cycleStateOf(doc.cycle ?? undefined, today),
  stale: isStale(doc.lastVerifiedOn, today),
});

/**
 * GET /api/opportunities?track=scholarship&sport=tennis
 *
 * One track's published records. With `sport`, the ones for that sport plus
 * every all-sports scheme, which is most of them. `sports` in the response is
 * the sport-specific slugs present, so the page only offers a sport filter
 * when there is more than one sport to choose between.
 */
export const listOpportunities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const track = req.query.track;
    if (!isTrack(track)) {
      throw new AppError(`track must be one of: ${OPPORTUNITY_TRACKS.join(", ")}.`, 400);
    }
    const sport =
      typeof req.query.sport === "string" ? req.query.sport.trim().toLowerCase() : undefined;

    const docs = await Opportunity.find({ track, status: "published" }).select(LIST_FIELDS).lean();

    const today = todayInIndia();
    const categoryOrder = OPPORTUNITY_CATEGORIES[track] as readonly string[];
    const sports = [...new Set(docs.flatMap((doc) => doc.sports ?? []))].sort();

    const items = docs
      .filter((doc) => !sport || doc.allSports || (doc.sports ?? []).includes(sport))
      .map((doc) => withState(doc, today))
      .sort(
        (a, b) =>
          categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
          CYCLE_ORDER[a.cycleState] - CYCLE_ORDER[b.cycleState] ||
          a.title.localeCompare(b.title)
      );

    res.json({ success: true, data: { items, sports, categories: categoryOrder } });
  }
);

/** GET /api/opportunities/:slug — one published record, in full. */
export const getOpportunity = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const slug = typeof req.params.slug === "string" ? req.params.slug.toLowerCase() : "";
  const doc = await Opportunity.findOne({ slug, status: "published" })
    .select("-updatedBy -watchUrls -__v")
    .lean();
  if (!doc) throw new AppError("Not found.", 404);

  res.json({ success: true, data: withState(doc, todayInIndia()) });
});
