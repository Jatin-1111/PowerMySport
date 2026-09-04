import { Request, Response } from "express";
import { Federation } from "../models/Federation";
import { TournamentEdition } from "../models/TournamentEdition";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

/**
 * The federation to attribute an edition to.
 *
 * Editions are keyed by sport, not by federation, so there is no stored link.
 * Most sports have exactly one federation and this is trivial; where there are
 * several, the event name almost always leads with the organiser's acronym
 * ("AITA CS7 (Delhi)"), which is a far better signal than picking the first row.
 */
async function resolveEditionFederation(
  sportSlug: string,
  editionName: string
): Promise<{ slug: string; name: string; acronym: string } | null> {
  const federations = await Federation.find({ sportSlug, isActive: true })
    .select("slug name acronym")
    .lean();
  if (federations.length === 0) return null;

  const leadingToken = (editionName.trim().split(/\s+/)[0] ?? "").toUpperCase();
  const byAcronym = federations.find((f) => f.acronym?.toUpperCase() === leadingToken);
  const chosen = byAcronym ?? federations[0]!;
  return { slug: chosen.slug, name: chosen.name, acronym: chosen.acronym };
}

/**
 * GET /api/tournament-editions/:slug
 * One dated edition, for the public /tournaments/[slug] page.
 */
export const getTournamentEdition = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const slug = typeof req.params.slug === "string" ? req.params.slug.toLowerCase() : "";
    if (!slug) {
      throw new AppError("A slug is required.", 400);
    }

    const edition = await TournamentEdition.findOne({ slug }).lean();
    if (!edition) {
      throw new AppError("Tournament not found.", 404);
    }

    const federation = await resolveEditionFederation(edition.sportSlug, edition.name);

    // A handful of other upcoming events in the same sport, so the page is a
    // stop on the way to a decision rather than a dead end. Same city first —
    // that is the choice a parent is actually making.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const related = await TournamentEdition.find({
      sportSlug: edition.sportSlug,
      _id: { $ne: edition._id },
      slug: { $exists: true, $ne: null },
      startDate: { $gte: startOfToday },
      status: { $ne: "cancelled" },
      ...(edition.city ? { city: edition.city } : {}),
    })
      .sort({ startDate: 1 })
      .limit(6)
      .select("slug name startDate city venue ageGroups level")
      .lean();

    res.json({ success: true, data: { edition, federation, related } });
  }
);

/**
 * GET /api/tournament-editions?limit=1000
 * Slug + timestamp only — this exists to feed the sitemap, so it deliberately
 * returns no content fields and skips editions that have already finished.
 */
export const listTournamentEditionSlugs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const limit = Math.min(5000, Math.max(1, parseInt((req.query.limit as string) || "2000", 10)));
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const editions = await TournamentEdition.find({
      slug: { $exists: true, $ne: null },
      startDate: { $gte: startOfToday },
      status: { $ne: "cancelled" },
    })
      .sort({ startDate: 1 })
      .limit(limit)
      .select("slug updatedAt")
      .lean();

    res.json({ success: true, data: editions });
  }
);
