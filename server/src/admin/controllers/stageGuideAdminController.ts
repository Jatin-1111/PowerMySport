import { Request, Response } from "express";

import { SportStageGuide } from "../../shared/models/SportStageGuide";
import {
  formatStageGuideIssues,
  StageGuideSchema,
} from "../../shared/validation/stageGuideFormat";
import { recordAuditLog } from "../services/AuditLogService";

// ─── Pathway stage guides ───────────────────────────────────────────────────
//
// Admin uploads a JSON file authored against `stageGuideFormat`; we validate it
// here and store it whole. Validation is strict and the errors are pathed
// (`stages[2].funding[0].benefit: …`) because the person fixing them is editing
// a JSON file by hand, and "invalid payload" would tell them nothing.

const normaliseState = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const auditContext = (
  req: Request,
): { adminId: string; adminEmail: string } | null => {
  if (!req.user?.id || !req.user.email) return null;
  return { adminId: req.user.id, adminEmail: req.user.email };
};

// ─── PUT /api/admin/stage-guides ────────────────────────────────────────────
// Upsert one guide. Body is the guide JSON itself, optionally wrapped as
// `{ guide, state, status }` when the uploader needs to say more than the file
// does.
export const upsertStageGuideAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const body = req.body ?? {};
    const payload = body.guide ?? body;
    const parsed = StageGuideSchema.safeParse(payload);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "The stage guide JSON did not match the format.",
        errors: formatStageGuideIssues(parsed.error),
      });
      return;
    }

    const guide = parsed.data;
    // A state on the wrapper overrides one inside the file, so the same file can
    // be uploaded for several states without editing it each time.
    const stateSlug = normaliseState(body.state ?? guide.state);
    const status = body.status === "draft" ? "draft" : "published";

    const saved = await SportStageGuide.findOneAndUpdate(
      { sportSlug: guide.sport.slug, stateSlug },
      {
        $set: {
          sportSlug: guide.sport.slug,
          stateSlug,
          status,
          formatVersion: guide.formatVersion,
          sportName: guide.sport.name,
          stageCount: guide.stages.length,
          verifiedOn: guide.verifiedOn,
          guide,
          uploadedBy: req.user?.id,
          uploadedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: "stageGuide.upsert",
        targetType: "SportStageGuide",
        targetId: String(saved?._id ?? ""),
        metadata: {
          sportSlug: guide.sport.slug,
          stateSlug,
          status,
          stageCount: guide.stages.length,
        },
      });
    }

    res.json({
      success: true,
      message: `Saved ${guide.stages.length} stages for ${guide.sport.name}${
        stateSlug ? ` (${stateSlug})` : ""
      }.`,
      data: {
        sportSlug: guide.sport.slug,
        stateSlug,
        status,
        stageCount: guide.stages.length,
      },
    });
  } catch (error) {
    console.error("[stageGuideAdmin] upsert failed", error);
    res.status(500).json({ success: false, message: "Failed to save the stage guide." });
  }
};

// ─── POST /api/admin/stage-guides/validate ──────────────────────────────────
// Dry run. Same validation, nothing written — so a file can be checked before
// it goes anywhere near the live page.
export const validateStageGuideAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const parsed = StageGuideSchema.safeParse(req.body?.guide ?? req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "The stage guide JSON did not match the format.",
      errors: formatStageGuideIssues(parsed.error),
    });
    return;
  }
  res.json({
    success: true,
    message: `Valid — ${parsed.data.stages.length} stages for ${parsed.data.sport.name}.`,
    data: {
      sportSlug: parsed.data.sport.slug,
      stageCount: parsed.data.stages.length,
      stages: parsed.data.stages.map((s) => ({ number: s.number, title: s.title })),
    },
  });
};

// ─── GET /api/admin/stage-guides ────────────────────────────────────────────
export const listStageGuidesAdmin = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const docs = await SportStageGuide.find({})
      .select("sportSlug sportName stateSlug status stageCount verifiedOn uploadedAt formatVersion")
      .sort({ sportName: 1, stateSlug: 1 })
      .lean();
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error("[stageGuideAdmin] list failed", error);
    res.status(500).json({ success: false, message: "Failed to list stage guides." });
  }
};

// ─── GET /api/admin/stage-guides/:sportSlug ─────────────────────────────────
// Returns the stored JSON so it can be downloaded, corrected and re-uploaded.
export const getStageGuideAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const doc = await SportStageGuide.findOne({
      sportSlug: String(req.params.sportSlug).toLowerCase(),
      stateSlug: normaliseState(req.query.state),
    }).lean();

    if (!doc) {
      res.status(404).json({ success: false, message: "No stage guide for that sport." });
      return;
    }
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("[stageGuideAdmin] get failed", error);
    res.status(500).json({ success: false, message: "Failed to load the stage guide." });
  }
};

// ─── DELETE /api/admin/stage-guides/:sportSlug ──────────────────────────────
export const deleteStageGuideAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const sportSlug = String(req.params.sportSlug).toLowerCase();
    const stateSlug = normaliseState(req.query.state);
    const deleted = await SportStageGuide.findOneAndDelete({ sportSlug, stateSlug }).lean();

    if (!deleted) {
      res.status(404).json({ success: false, message: "No stage guide for that sport." });
      return;
    }

    const audit = auditContext(req);
    if (audit) {
      void recordAuditLog({
        ...audit,
        action: "stageGuide.delete",
        targetType: "SportStageGuide",
        targetId: String(deleted._id),
        metadata: { sportSlug, stateSlug },
      });
    }

    res.json({ success: true, message: "Stage guide deleted." });
  } catch (error) {
    console.error("[stageGuideAdmin] delete failed", error);
    res.status(500).json({ success: false, message: "Failed to delete the stage guide." });
  }
};
