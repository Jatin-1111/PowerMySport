import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { ChildHistoryService } from "../services/ChildHistoryService";
import { ChildVideoService } from "../services/ChildVideoService";

/**
 * A child's sporting history, for the parent who owns the child.
 *
 * Thin by design: ownership, text cleaning, dates and the per-child cap live in
 * `ChildHistoryService`, where they are read together and tested without HTTP. The body was
 * already checked for shape by `validateRequest` in the route.
 */

const requireUser = (req: Request): string => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  return req.user.id;
};

const childIdOf = (req: Request): string => String(req.params.childId ?? "");

/** GET /api/child-history/:childId */
export const getChildHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildHistoryService.get(requireUser(req), childIdOf(req));
  res.json({ success: true, data });
});

/** POST /api/child-history/:childId/events */
export const createChildEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildHistoryService.createEvent(requireUser(req), childIdOf(req), req.body);
  res.status(201).json({ success: true, data });
});

/** PATCH /api/child-history/:childId/events/:eventId */
export const updateChildEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildHistoryService.updateEvent(
    requireUser(req),
    childIdOf(req),
    String(req.params.eventId ?? ""),
    req.body
  );
  res.json({ success: true, data });
});

/** DELETE /api/child-history/:childId/events/:eventId */
export const deleteChildEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await ChildHistoryService.deleteEvent(
    requireUser(req),
    childIdOf(req),
    String(req.params.eventId ?? "")
  );
  res.json({ success: true });
});

/** POST /api/child-history/video-consent  { accepted: true } */
export const recordVideoConsent = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await ChildVideoService.recordConsent(requireUser(req));
    res.json({ success: true });
  }
);

/** POST /api/child-history/:childId/videos  { contentType, sizeBytes, durationSeconds?, title? } */
export const startVideoUpload = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildVideoService.startUpload(requireUser(req), childIdOf(req), req.body);
  res.status(201).json({ success: true, data });
});

/** POST /api/child-history/:childId/videos/:videoId/complete  { parts: [{ partNumber, etag }] } */
export const completeVideoUpload = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await ChildVideoService.completeUpload(
      requireUser(req),
      childIdOf(req),
      String(req.params.videoId ?? ""),
      req.body.parts
    );
    res.json({ success: true, data });
  }
);

/** GET /api/child-history/:childId/videos/:videoId/playback */
export const getVideoPlayback = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const data = await ChildVideoService.playbackUrl(
    requireUser(req),
    childIdOf(req),
    String(req.params.videoId ?? "")
  );
  // A signed link is a credential for a few minutes: it must not be stored by a cache.
  res.set("Cache-Control", "no-store");
  res.json({ success: true, data });
});

/** DELETE /api/child-history/:childId/videos/:videoId */
export const deleteVideo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await ChildVideoService.deleteVideo(
    requireUser(req),
    childIdOf(req),
    String(req.params.videoId ?? "")
  );
  res.json({ success: true });
});

/** PUT /api/child-history/:childId/academics */
export const saveChildAcademics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await ChildHistoryService.saveAcademics(
      requireUser(req),
      childIdOf(req),
      req.body
    );
    res.json({ success: true, data });
  }
);
