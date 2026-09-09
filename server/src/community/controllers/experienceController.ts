import { Request, Response } from "express";
import { ExperienceSubjectService } from "../services/ExperienceSubjectService";
import { BlogService } from "../services/BlogService";
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

// ─── Right of reply ─────────────────────────────────────────────────────────
// The one response a named coach or expert may post to what was written about
// them. Ownership is re-checked server-side inside postSubjectReply — the
// request only carries who is asking, never a claim of who they are.
export const postExperienceSubjectReply = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }
    const { content } = req.body as { content?: string };
    if (!content || !content.trim()) {
      throw new AppError("Reply cannot be empty", 400);
    }

    try {
      await ExperienceSubjectService.postSubjectReply(
        req.user.id,
        String(req.params.blogId || ""),
        content
      );
      const data = await BlogService.getBlog(req.user.id, String(req.params.blogId || ""));
      res.status(200).json({ success: true, message: "Reply posted", data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to post reply";
      const status =
        message === "Access denied"
          ? 403
          : message.includes("not found")
            ? 404
            : message.includes("already")
              ? 409
              : 400;
      throw new AppError(message, status);
    }
  }
);
