import { Request, Response } from "express";
import { ExperienceSubjectService } from "../services/ExperienceSubjectService";
import { EXPERIENCE_SUBJECT_KINDS, type ExperienceSubjectKind } from "../constants/experience";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

/**
 * The two endpoints that are genuinely new for Experience — everything else
 * (posts, likes, comments, profiles) is the existing blog machinery, reachable
 * under this same `/api/community/experiences` mount via experienceRoutes.ts.
 */

const isSubjectKind = (value: unknown): value is ExperienceSubjectKind =>
  typeof value === "string" && (EXPERIENCE_SUBJECT_KINDS as readonly string[]).includes(value);

// ─── Subject search ─────────────────────────────────────────────────────────
// Backs the composer's "was this about a tournament, venue, academy or coach?"
// autocomplete.
export const searchExperienceSubjects = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;

    if (kind && !isSubjectKind(kind)) {
      throw new AppError("Invalid subject kind", 400);
    }

    const data = await ExperienceSubjectService.searchSubjects(q, kind);
    res.status(200).json({ success: true, message: "Subjects fetched", data });
  }
);

// ─── Entity summary ─────────────────────────────────────────────────────────
// Backs the "Parent experiences" band on a tournament / venue / academy /
// coach / expert page — sits below that page's existing star-rating band.
export const getExperienceSubjectSummary = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
    const refId = typeof req.query.refId === "string" ? req.query.refId : undefined;

    if (!kind || !isSubjectKind(kind)) {
      throw new AppError("A valid subject kind is required", 400);
    }
    if (!refId) {
      throw new AppError("refId is required", 400);
    }

    try {
      const data = await ExperienceSubjectService.getSummary(kind, refId);
      res.status(200).json({ success: true, message: "Summary fetched", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch summary";
      throw new AppError(message, message.includes("Cast to ObjectId") ? 400 : 500);
    }
  }
);
