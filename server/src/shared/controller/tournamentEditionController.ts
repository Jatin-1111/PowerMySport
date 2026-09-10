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
 * The recurring series an edition belongs to, as a comparable key.
 *
 * "22nd Delhi International Open Grandmasters Chess Tournament" and its 2027
 * running differ only by the ordinal and the year, so both reduce to "delhi
 * grandmasters". Used to point a finished event at its next running, which is
 * the one thing someone searching for a tournament that already happened
 * actually wants.
 */
function seriesKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(\d+(st|nd|rd|th)?|20\d\d|fide|rated|rating|open|chess|tournament|tournaments|championship|championships|all|india|international|the|for|below|above|cat|category|edition)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
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

    // A merged duplicate exists only to redirect, so skip the work that builds
    // a page nobody will see.
    if (edition.mergedInto) {
      res.json({
        success: true,
        data: { edition, federation: null, related: [], nextInSeries: null },
      });
      return;
    }

    const federation = await resolveEditionFederation(edition.sportSlug, edition.name);

    // Other upcoming events in the same sport, so the page is a stop on the way
    // to a decision rather than a dead end.
    //
    // Pulled sport-wide and ranked here rather than filtered to the edition's
    // city in the query: city used to be a hard filter, which meant a tournament
    // in a city with nothing else coming up rendered no onward links at all.
    // That hits finished events hardest — they are precisely the pages where the
    // rest of the content is no longer useful. Same city still sorts first.
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const upcoming = await TournamentEdition.find({
      sportSlug: edition.sportSlug,
      _id: { $ne: edition._id },
      slug: { $exists: true, $ne: null },
      startDate: { $gte: startOfToday },
      status: { $ne: "cancelled" },
      // Merged duplicates only redirect; listing them would show the same
      // tournament two or three times in a row (see migration 41).
      mergedInto: { $in: [null, undefined] },
    })
      .sort({ startDate: 1 })
      .limit(400)
      .select("slug name startDate city venue ageGroups level")
      .lean();

    const key = seriesKey(edition.name);
    const nextInSeries = key ? (upcoming.find((e) => seriesKey(e.name) === key) ?? null) : null;

    const sameCity = edition.city ? upcoming.filter((e) => e.city === edition.city) : [];
    const related = [...sameCity, ...upcoming.filter((e) => !sameCity.includes(e))]
      .filter((e) => !nextInSeries || String(e._id) !== String(nextInSeries._id))
      .slice(0, 6);

    res.json({ success: true, data: { edition, federation, related, nextInSeries } });
  }
);

/**
 * GET /api/tournament-editions?limit=1000
 * Slug + timestamp only — this exists to feed the sitemap, so it deliberately
 * returns no content fields and skips editions that have already finished.
 *
 * GET /api/tournament-editions?sport=chess&page=1&limit=24&upcoming=false
 * Card-shape, paginated editions for one sport — backs the /tournaments/sport/[sport]
 * hub page. A separate branch on the same route rather than a new one: both are
 * "list editions", and the sitemap's unfiltered call (no `sport`) keeps its exact
 * existing shape so nothing else has to change.
 */
export const listTournamentEditionSlugs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const sportSlug = typeof req.query.sport === "string" ? req.query.sport.toLowerCase() : "";

    // The merge map, for next.config.ts to turn into real 308s at build time.
    // Redirecting from the page component instead only ever produces a
    // `<meta http-equiv="refresh">` on a 200, because by the time a Server
    // Component throws, the response has already been committed — and a meta
    // refresh does not consolidate ranking signals the way an HTTP redirect
    // does, which is the whole reason these rows were merged.
    if (req.query.merged === "true") {
      const merged = await TournamentEdition.find({
        slug: { $exists: true, $ne: null },
        mergedInto: { $exists: true, $ne: null },
      })
        .select("slug mergedInto")
        .lean();

      res.json({ success: true, data: merged });
      return;
    }

    if (sportSlug) {
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.min(60, Math.max(1, parseInt((req.query.limit as string) || "24", 10)));
      const upcoming = req.query.upcoming !== "false";
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      const filter = {
        sportSlug,
        slug: { $exists: true, $ne: null },
        status: { $ne: "cancelled" },
        startDate: upcoming ? { $gte: startOfToday } : { $lt: startOfToday },
        mergedInto: { $in: [null, undefined] },
      };

      const [editions, total] = await Promise.all([
        TournamentEdition.find(filter)
          .sort({ startDate: upcoming ? 1 : -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select("slug name officialName startDate endDate city state venue level ageGroups")
          .lean(),
        TournamentEdition.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: { editions, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
      return;
    }

    const limit = Math.min(5000, Math.max(1, parseInt((req.query.limit as string) || "2000", 10)));
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const editions = await TournamentEdition.find({
      slug: { $exists: true, $ne: null },
      startDate: { $gte: startOfToday },
      status: { $ne: "cancelled" },
      // A merged duplicate redirects, so submitting it would ask Google to
      // crawl a URL whose only job is to hand it back to the survivor.
      mergedInto: { $in: [null, undefined] },
    })
      .sort({ startDate: 1 })
      .limit(limit)
      .select("slug updatedAt")
      .lean();

    res.json({ success: true, data: editions });
  }
);
