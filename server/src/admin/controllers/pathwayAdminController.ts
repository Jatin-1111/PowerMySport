import { Request, Response } from "express";
import mongoose from "mongoose";
import { SportPathway } from "../../shared/models/SportPathway";
import { recordAuditLog } from "../services/AuditLogService";
import { buildSafeSearchRegexSource } from "../../utils/regex";

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

    const filter: Record<string, unknown> = {};
    if (search.trim()) {
      const regex = new RegExp(buildSafeSearchRegexSource(search), "i");
      filter.$or = [{ sportName: regex }, { sportSlug: regex }];
    }
    if (verifiedParam === "true") filter.isVerified = true;
    if (verifiedParam === "false") filter.isVerified = { $ne: true };

    const [docs, total] = await Promise.all([
      SportPathway.find(filter)
        .select(
          "sportName sportSlug cacheKey category isVerified verifiedAt lookupCount lastRefreshedAt createdAt",
        )
        .sort({ sportName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SportPathway.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: docs,
      pagination: { total, page, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch pathways",
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
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid pathway ID" });
      return;
    }

    const pathway = await SportPathway.findById(id)
      .populate("verifiedBy", "name email")
      .lean();
    if (!pathway) {
      res.status(404).json({ success: false, message: "Pathway not found" });
      return;
    }

    res.status(200).json({ success: true, data: pathway });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch pathway",
    });
  }
};

// ─── PATCH /api/admin/sport-pathways/:id ───────────────────────────────────────
// Edits pathway content. Only these fields are admin-editable — tournaments/
// scholarships/universities stay exclusively owned by the canonical collections
// and lookupCount/cacheKey/slug are identity/telemetry fields, not content.

const EDITABLE_FIELDS = ["overview", "category", "levels", "equipment", "careers"] as const;

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
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid pathway ID" });
      return;
    }

    const update: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ success: false, message: "No editable fields provided" });
      return;
    }

    if (update.levels && (!Array.isArray(update.levels) || update.levels.length !== 5)) {
      res.status(400).json({ success: false, message: "levels must be an array of exactly 5 items" });
      return;
    }

    const pathway = await SportPathway.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true },
    ).populate("verifiedBy", "name email");

    if (!pathway) {
      res.status(404).json({ success: false, message: "Pathway not found" });
      return;
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: "pathway.edit",
      targetType: "SportPathway",
      targetId: id,
      metadata: { fields: Object.keys(update) },
    });

    res.status(200).json({ success: true, message: "Pathway updated", data: pathway });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update pathway",
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
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid pathway ID" });
      return;
    }

    const verified = req.body?.verified !== false; // default true

    const pathway = await SportPathway.findByIdAndUpdate(
      id,
      verified
        ? { $set: { isVerified: true, verifiedAt: new Date(), verifiedBy: req.user.id } }
        : { $set: { isVerified: false, verifiedAt: null, verifiedBy: null } },
      { new: true },
    ).populate("verifiedBy", "name email");

    if (!pathway) {
      res.status(404).json({ success: false, message: "Pathway not found" });
      return;
    }

    void recordAuditLog({
      adminId: req.user.id,
      adminEmail: req.user.email || "",
      action: verified ? "pathway.verify" : "pathway.unverify",
      targetType: "SportPathway",
      targetId: id,
    });

    res.status(200).json({
      success: true,
      message: verified ? "Pathway marked as verified" : "Pathway verification removed",
      data: pathway,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to update verification status",
    });
  }
};
