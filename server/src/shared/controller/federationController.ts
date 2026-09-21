import { Request, Response } from "express";
import { Federation } from "../models/Federation";
import { Tournament } from "../models/Tournament";
import { TournamentEdition } from "../models/TournamentEdition";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

/**
 * GET /api/federations?sport=tennis
 */
export const listFederations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { sport } = req.query;
  const filter: Record<string, unknown> = { isActive: true };
  if (sport && typeof sport === "string") {
    filter.sportSlug = sport.toLowerCase().trim();
  }
  const federations = await Federation.find(filter)
    .select(
      "-stateAssociations -eligibilityCriteria -registrationSteps -requiredDocuments -sourceUrls"
    )
    .lean();
  res.json({ success: true, data: federations });
});

/**
 * GET /api/federations/:slug
 */
export const getFederation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const slug = typeof req.params.slug === "string" ? req.params.slug : "";
  const fed = await Federation.findOne({ slug: slug.toLowerCase() }).lean();
  if (!fed) {
    throw new AppError("Federation not found.", 404);
  }
  res.json({ success: true, data: fed });
});

/**
 * GET /api/federations/:slug/tournaments?level=national&ageGroup=U-14&page=1&limit=20
 */
export const getFederationTournaments = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    const { level, ageGroup, page = "1", limit = "20" } = req.query;

    const fed = await Federation.findOne({ slug: slug.toLowerCase() })
      .select("sportSlug acronym")
      .lean();
    if (!fed) {
      throw new AppError("Federation not found.", 404);
    }

    // Prefer the hard federationSlug reference; fall back to matching the
    // denormalized acronym snapshot (tournaments approved before that field
    // existed), then to sport-wide if neither yields anything (legacy data).
    const baseFilter: Record<string, unknown> = {
      sportSlug: fed.sportSlug,
      isCurated: true,
    };
    const slugFilter = { ...baseFilter, federationSlug: slug.toLowerCase() };
    const acronymFilter = { ...baseFilter, "federation.acronym": fed.acronym };

    const slugCount = await Tournament.countDocuments(slugFilter);
    let filter: Record<string, unknown>;
    if (slugCount > 0) {
      filter = slugFilter;
    } else {
      const acronymCount = await Tournament.countDocuments(acronymFilter);
      filter = acronymCount > 0 ? acronymFilter : baseFilter;
    }

    if (level && typeof level === "string") {
      (filter as any).level = { $regex: new RegExp(level, "i") };
    }
    if (ageGroup && typeof ageGroup === "string") {
      (filter as any).ageGroup = { $regex: new RegExp(ageGroup, "i") };
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [tournaments, total] = await Promise.all([
      Tournament.find(filter).sort({ level: 1, name: 1 }).skip(skip).limit(limitNum).lean(),
      Tournament.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        tournaments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  }
);

/**
 * GET /api/federations/:slug/editions?limit=50
 * Upcoming dated tournament editions this federation itself sanctions,
 * populated via the admin data-source review flow (TOURNAMENT_CALENDAR
 * submissions in DataSourceExtractionService.ts / dataSourceAdminController.ts)
 * and attributed to the federation whose calendar they were read from.
 *
 * Scoped to that federation on purpose. This used to return the whole sport's
 * calendar, which meant all four tennis federation pages served an identical
 * list — and since AITA's is the only tennis calendar sourced so far, UTR's
 * page presented AITA ranking events as UTR's own, directly contradicting the
 * key fact printed above them that UTR results earn no AITA ranking.
 *
 * A federation whose calendar nobody has sourced yet returns nothing, and the
 * client says so and links to the official calendar. That is the honest
 * answer; borrowing another body's events is not.
 */
export const getFederationEditions = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    const { limit = "50" } = req.query;

    const fed = await Federation.findOne({ slug: slug.toLowerCase() }).select("sportSlug").lean();
    if (!fed) {
      throw new AppError("Federation not found.", 404);
    }

    // Generous ceiling on purpose: the client renders a month-navigated
    // calendar, so a low cap silently truncates the far months rather than
    // paginating. High-volume sports need it — chess alone has ~285 upcoming
    // editions and tennis ~109, and a cap of 100 hid everything past October.
    const limitNum = Math.min(400, Math.max(1, parseInt(limit as string, 10) || 200));
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const editions = await TournamentEdition.find({
      sportSlug: fed.sportSlug,
      federationSlug: slug.toLowerCase(),
      startDate: { $gte: startOfToday },
      status: { $ne: "cancelled" },
    })
      .sort({ startDate: 1 })
      .limit(limitNum)
      .lean();

    const lastCheckedAt = editions.reduce<Date | null>(
      (latest, e) => (!latest || e.lastCheckedAt > latest ? e.lastCheckedAt : latest),
      null
    );

    res.json({ success: true, data: { editions, lastCheckedAt } });
  }
);
