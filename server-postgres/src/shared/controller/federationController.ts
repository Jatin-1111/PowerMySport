import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

const fail = (res: Response, error: unknown, code = 400) =>
  res.status(code).json({
    success: false,
    message: error instanceof Error ? error.message : "Request failed",
  });

// Mirrors the Mongoose `.select("-stateAssociations -eligibilityCriteria
// -registrationSteps -requiredDocuments -sourceUrls")` projection on the list
// endpoint. Prisma has no negative projection, so we enumerate the kept fields.
const listSelect = {
  id: true,
  slug: true,
  name: true,
  acronym: true,
  sportSlug: true,
  type: true,
  about: true,
  founded: true,
  headquarters: true,
  website: true,
  officialCalendarUrl: true,
  socialLinks: true,
  affiliations: true,
  keyFacts: true,
  contact: true,
  dataVerifiedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FederationSelect;

/**
 * GET /api/federations?sport=tennis
 */
export const listFederations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { sport } = req.query;
    const where: Prisma.FederationWhereInput = { isActive: true };
    if (sport && typeof sport === "string") {
      where.sportSlug = sport.toLowerCase().trim();
    }
    const federations = await prisma.federation.findMany({
      where,
      select: listSelect,
    });
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
    const fed = await prisma.federation.findUnique({
      where: { slug: slug.toLowerCase() },
    });
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

    const fed = await prisma.federation.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { sportSlug: true, acronym: true },
    });
    if (!fed) {
      res.status(404).json({ success: false, message: "Federation not found." });
      return;
    }

    // Filter by both sportSlug and the federation acronym embedded in each tournament.
    // Falls back to sport-only if no tournaments match the acronym filter (e.g. legacy data).
    // NOTE: the embedded Mongo `federation.acronym` is the flattened `fedAcronym`
    // column in Postgres.
    const baseFilter: Prisma.TournamentWhereInput = {
      sportSlug: fed.sportSlug,
      isCurated: true,
    };
    const acronymFilter: Prisma.TournamentWhereInput = {
      ...baseFilter,
      fedAcronym: fed.acronym,
    };

    // Use acronym filter when it yields results, else fall back to sport-wide
    const acronymCount = await prisma.tournament.count({
      where: acronymFilter,
    });
    const filter: Prisma.TournamentWhereInput =
      acronymCount > 0 ? acronymFilter : baseFilter;

    // NOTE (behavioral): the Mongo version compiled `new RegExp(level, "i")`.
    // Postgres `contains` + `mode:'insensitive'` is a parameterized ILIKE, so
    // there is no regex engine to attack and `%`/`_` are treated literally.
    if (level && typeof level === "string") {
      filter.level = { contains: level, mode: "insensitive" };
    }
    if (ageGroup && typeof ageGroup === "string") {
      filter.ageGroup = { contains: ageGroup, mode: "insensitive" };
    }

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where: filter,
        orderBy: [{ level: "asc" }, { name: "asc" }],
        skip,
        take: limitNum,
      }),
      prisma.tournament.count({ where: filter }),
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
