import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { cvChoiceQuerySchema } from "../services/ChildHistoryService/schemas";
import { ChildShareService } from "../services/ChildShareService";

/**
 * Links to a child's profile: the parent makes and stops them, and anyone holding one can open it.
 *
 * Thin by design. What a link may show is decided in `ChildShareService/serialize`, and whether a
 * link works is decided from the database on every request.
 */

const requireUser = (req: Request): string => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  return req.user.id;
};

const childIdOf = (req: Request): string => String(req.params.childId ?? "");
const tokenOf = (req: Request): string => String(req.params.token ?? "");

// ─── The parent's side ───────────────────────────────────────────────────────

/** POST /api/child-history/:childId/shares/preview  { sections, videoIds? } */
export const previewShare = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildShareService.preview(requireUser(req), childIdOf(req), req.body);
  res.set("Cache-Control", "no-store");
  res.json({ success: true, data });
});

/** POST /api/child-history/:childId/shares  { recipientLabel, sections, videoIds?, consent: true } */
export const createShare = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildShareService.create(requireUser(req), childIdOf(req), req.body);
  // The link is in this response and nowhere else.
  res.set("Cache-Control", "no-store");
  res.status(201).json({ success: true, data });
});

/** GET /api/child-history/:childId/shares */
export const listShares = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildShareService.list(requireUser(req), childIdOf(req));
  res.json({ success: true, data });
});

/** DELETE /api/child-history/:childId/shares/:shareId  (stops the link; it is kept to say so) */
export const revokeShare = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildShareService.revoke(
    requireUser(req),
    childIdOf(req),
    String(req.params.shareId ?? "")
  );
  res.json({ success: true, data });
});

const sendPdf = (res: Response, file: { pdf: Buffer; fileName: string }): void => {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${file.fileName}"`,
    "Content-Length": String(file.pdf.length),
    // The same rule as the page: a file made for one link or one preview is never kept by a cache.
    "Cache-Control": "no-store",
  });
  res.send(file.pdf);
};

/** GET /api/child-history/:childId/cv.pdf?sections=results,academics&videoIds=a,b */
export const previewCv = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = cvChoiceQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError("Choose what to include in the CV.", 400);
  const { sections, videoIds } = parsed.data;
  sendPdf(
    res,
    await ChildShareService.cvPreview(requireUser(req), childIdOf(req), {
      sections,
      ...(videoIds ? { videoIds } : {}),
    })
  );
});

// ─── Anyone holding a link ───────────────────────────────────────────────────

/** GET /api/share/:token */
export const openSharedProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await ChildShareService.openPublic(tokenOf(req));
    res.json({ success: true, data });
  }
);

/** GET /api/share/:token/cv.pdf */
export const downloadSharedCv = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  sendPdf(res, await ChildShareService.cvPublic(tokenOf(req)));
});

/** POST /api/share/:token/contact  { name, email, message? } */
export const requestContact = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildShareService.contact(tokenOf(req), req.body);
  res.status(201).json({ success: true, data });
});

/** GET /api/share/:token/videos/:videoId/playback */
export const playSharedVideo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildShareService.playbackFor(tokenOf(req), String(req.params.videoId ?? ""));
  res.json({ success: true, data });
});
