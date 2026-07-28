import { Request, Response } from "express";
import { Federation } from "../models/Federation";
import { Tournament } from "../models/Tournament";
import { TournamentEdition } from "../models/TournamentEdition";

const fail = (res: Response, error: unknown, code = 400) =>
  res.status(code).json({
    success: false,
    message: error instanceof Error ? error.message : "Request failed",
  });

/**
 * GET /api/federations?sport=tennis
 */
export const listFederations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sport } = req.query;
    const filter: Record<string, unknown> = { isActive: true };
    if (sport && typeof sport === "string") {
      filter.sportSlug = sport.toLowerCase().trim();
    }
    const federations = await Federation.find(filter)
      .select(
        "-stateAssociations -eligibilityCriteria -registrationSteps -requiredDocuments -sourceUrls",
      )
      .lean();
    res.json({ success: true, data: federations });
  } catch (err) {
    fail(res, err, 500);
  }
};

/**
 * GET /api/federations/:slug
 */
export const getFederation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    const fed = await Federation.findOne({ slug: slug.toLowerCase() }).lean();
    if (!fed) {
      res.status(404).json({ success: false, message: "Federation not found." });
      return;
    }
    res.json({ success: true, data: fed });
  } catch (err) {
    fail(res, err, 500);
  }
};

/**
 * GET /api/federations/:slug/tournaments?level=national&ageGroup=U-14&page=1&limit=20
 */
export const getFederationTournaments = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    const { level, ageGroup, page = "1", limit = "20" } = req.query;

    const fed = await Federation.findOne({ slug: slug.toLowerCase() })
      .select("sportSlug acronym")
      .lean();
    if (!fed) {
      res.status(404).json({ success: false, message: "Federation not found." });
      return;
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
      Tournament.find(filter)
        .sort({ level: 1, name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
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
  } catch (err) {
    fail(res, err, 500);
  }
};

/**
 * GET /api/federations/:slug/editions?limit=50
 * Upcoming dated tournament editions for this federation's sport, populated
 * via the admin data-source review flow (TOURNAMENT_CALENDAR submissions in
 * DataSourceExtractionService.ts / dataSourceAdminController.ts). Editions
 * are keyed by sportSlug only (not a specific federation), so this is the
 * sport-wide calendar, not filtered to this federation's own events.
 */
export const getFederationEditions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const slug = typeof req.params.slug === "string" ? req.params.slug : "";
    const { limit = "50" } = req.query;

    const fed = await Federation.findOne({ slug: slug.toLowerCase() })
      .select("sportSlug")
      .lean();
    if (!fed) {
      res.status(404).json({ success: false, message: "Federation not found." });
      return;
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
      startDate: { $gte: startOfToday },
      status: { $ne: "cancelled" },
    })
      .sort({ startDate: 1 })
      .limit(limitNum)
      .lean();

    const lastCheckedAt = editions.reduce<Date | null>(
      (latest, e) => (!latest || e.lastCheckedAt > latest ? e.lastCheckedAt : latest),
      null,
    );

    res.json({ success: true, data: { editions, lastCheckedAt } });
  } catch (err) {
    fail(res, err, 500);
  }
};
