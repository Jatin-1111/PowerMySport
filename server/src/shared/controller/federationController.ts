import { Request, Response } from "express";
import { Federation } from "../models/Federation";
import { Tournament } from "../models/Tournament";

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

    // Filter by both sportSlug and the federation acronym embedded in each tournament.
    // Falls back to sport-only if no tournaments match the acronym filter (e.g. legacy data).
    const baseFilter: Record<string, unknown> = {
      sportSlug: fed.sportSlug,
      isCurated: true,
    };
    const acronymFilter = { ...baseFilter, "federation.acronym": fed.acronym };

    // Use acronym filter when it yields results, else fall back to sport-wide
    const acronymCount = await Tournament.countDocuments(acronymFilter);
    const filter: Record<string, unknown> = acronymCount > 0 ? acronymFilter : baseFilter;

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
