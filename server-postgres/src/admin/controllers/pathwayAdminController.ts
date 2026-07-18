import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { recordAuditLog } from "../services/AuditLogService";

// verifiedBy is a String FK -> Admin.id (no Prisma relation defined). The old
// Mongoose `.populate("verifiedBy", "name email")` becomes a second lookup that
// swaps the id for the admin's { id, name, email } (or null if missing).
async function attachVerifiedByAdmin<T extends { verifiedBy: string | null }>(
  pathway: T,
): Promise<T & { verifiedBy: unknown }> {
  if (!pathway.verifiedBy) return pathway;
  const admin = await prisma.admin.findUnique({
    where: { id: pathway.verifiedBy },
    select: { id: true, name: true, email: true },
  });
  return { ...pathway, verifiedBy: admin };
}

// ─── GET /api/admin/sport-pathways ─────────────────────────────────────────────
// List pathways with search + verified filter + pagination.

export const listPathwaysAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit as string) || "20", 10)),
    );
    const search = (req.query.search as string) || "";
    const verifiedParam = req.query.isVerified as string | undefined;

    const where: any = {};
    if (search.trim()) {
      where.OR = [
        { sportName: { contains: search.trim(), mode: "insensitive" } },
        { sportSlug: { contains: search.trim(), mode: "insensitive" } },
      ];
    }
    if (verifiedParam === "true") where.isVerified = true;
    if (verifiedParam === "false") where.isVerified = { not: true };

    const [docs, total] = await Promise.all([
      // TODO(prisma): original also selected `lastRefreshedAt`, which has no
      // column in the Prisma schema (see contentRefreshedAt /
      // financialDataRefreshedAt) — dropped from the projection.
      prisma.sportPathway.findMany({
        where,
        select: {
          id: true,
          sportName: true,
          sportSlug: true,
          cacheKey: true,
          category: true,
          isVerified: true,
          verifiedAt: true,
          lookupCount: true,
          createdAt: true,
        },
        orderBy: { sportName: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sportPathway.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: docs,
      pagination: {
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch pathways",
    });
  }
};

// ─── GET /api/admin/sport-pathways/:id ─────────────────────────────────────────

export const getPathwayAdminDetail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    // TODO(prisma): ids are cuids now, not Mongo ObjectIds — dropped
    // mongoose.isValidObjectId() guard; only presence/type is validated.
    if (!id || typeof id !== "string") {
      res.status(400).json({ success: false, message: "Invalid pathway ID" });
      return;
    }

    const pathway = await prisma.sportPathway.findUnique({ where: { id } });
    if (!pathway) {
      res.status(404).json({ success: false, message: "Pathway not found" });
      return;
    }

    res
      .status(200)
      .json({ success: true, data: await attachVerifiedByAdmin(pathway) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch pathway",
    });
  }
};

// ─── PATCH /api/admin/sport-pathways/:id ───────────────────────────────────────
// Edits pathway content. Only these fields are admin-editable — tournaments/
// scholarships/universities stay exclusively owned by the canonical collections
// and lookupCount/cacheKey/slug are identity/telemetry fields, not content.

const EDITABLE_FIELDS = [
  "overview",
  "category",
  "levels",
  "equipment",
  "careers",
  "tournamentsVerifiedEmpty",
  "scholarshipsVerifiedEmpty",
  "universitiesVerifiedEmpty",
] as const;

export const updatePathwayAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    // TODO(prisma): ids are cuids now, not Mongo ObjectIds — dropped
    // mongoose.isValidObjectId() guard; only presence/type is validated.
    if (!id || typeof id !== "string") {
      res.status(400).json({ success: false, message: "Invalid pathway ID" });
      return;
    }

    const update: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    if (Object.keys(update).length === 0) {
      res
        .status(400)
        .json({ success: false, message: "No editable fields provided" });
      return;
    }

    if (
      update.levels &&
      (!Array.isArray(update.levels) || update.levels.length !== 5)
    ) {
      res
        .status(400)
        .json({
          success: false,
          message: "levels must be an array of exactly 5 items",
        });
      return;
    }

    // Original findByIdAndUpdate returned null (→ 404) when the id was missing;
    // Prisma update throws, so check existence first.
    const existing = await prisma.sportPathway.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: "Pathway not found" });
      return;
    }

    const pathway = await prisma.sportPathway.update({
      where: { id },
      data: update as any,
    });

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "pathway.edit",
      targetType: "SportPathway",
      targetId: id,
      metadata: { fields: Object.keys(update) },
    });

    res.status(200).json({
      success: true,
      message: "Pathway updated",
      data: await attachVerifiedByAdmin(pathway),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update pathway",
    });
  }
};

// ─── POST /api/admin/sport-pathways/:id/verify ─────────────────────────────────
// Toggles expert-verified status. Verifying protects the pathway from the
// automatic AI refresh pipeline (see PathwayService.getStalePathways/refreshPathway).

export const setPathwayVerifiedAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    // TODO(prisma): ids are cuids now, not Mongo ObjectIds — dropped
    // mongoose.isValidObjectId() guard; only presence/type is validated.
    if (!id || typeof id !== "string") {
      res.status(400).json({ success: false, message: "Invalid pathway ID" });
      return;
    }

    const verified = req.body?.verified !== false; // default true

    const existingPathway = await prisma.sportPathway.findUnique({
      where: { id },
    });
    if (!existingPathway) {
      res.status(404).json({ success: false, message: "Pathway not found" });
      return;
    }

    if (verified) {
      // Validate that all government schemes have sources and dates
      for (const level of (existingPathway as any).levels || []) {
        for (const scheme of level.governmentSchemes || []) {
          if (!scheme.sourceURL || !scheme.verifiedAsOf) {
            res.status(400).json({
              success: false,
              message:
                "Cannot verify: All government schemes must have a sourceURL and a verifiedAsOf date.",
            });
            return;
          }
        }
      }
    }

    const pathway = await prisma.sportPathway.update({
      where: { id },
      data: verified
        ? {
            isVerified: true,
            verifiedAt: new Date(),
            verifiedBy: req.user.id,
          }
        : { isVerified: false, verifiedAt: null, verifiedBy: null },
    });

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: verified ? "pathway.verify" : "pathway.unverify",
      targetType: "SportPathway",
      targetId: id,
    });

    res.status(200).json({
      success: true,
      message: verified
        ? "Pathway marked as verified"
        : "Pathway verification removed",
      data: await attachVerifiedByAdmin(pathway),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update verification status",
    });
  }
};
