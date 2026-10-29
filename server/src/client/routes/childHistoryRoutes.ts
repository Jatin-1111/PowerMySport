import { Router } from "express";
import {
  completeVideoUpload,
  createChildEvent,
  deleteChildEvent,
  deleteVideo,
  getChildHistory,
  getVideoPlayback,
  recordVideoConsent,
  saveChildAcademics,
  startVideoUpload,
  updateChildEvent,
} from "../controllers/childHistoryController";
import {
  createShare,
  listShares,
  previewCv,
  previewShare,
  revokeShare,
} from "../controllers/childShareController";
import { authMiddleware } from "../../middleware/auth";
import { dependentsWriteRateLimiter } from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validation";
import {
  completeVideoUploadSchema,
  createChildEventSchema,
  createShareSchema,
  previewShareSchema,
  saveAcademicsSchema,
  startVideoUploadSchema,
  updateChildEventSchema,
  videoConsentSchema,
} from "../services/ChildHistoryService/schemas";

const childHistoryRouter = Router();

// A child's history is always about a profile this account owns, so every route is
// authenticated and every handler re-checks that ownership rather than trusting the id in the
// path. Writes share the limit used for every other change to a child's profile.

// Before the "/:childId" routes, so "video-consent" is never read as a child's id.
childHistoryRouter.post(
  "/video-consent",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(videoConsentSchema),
  recordVideoConsent
);

childHistoryRouter.get("/:childId", authMiddleware, getChildHistory);
childHistoryRouter.post(
  "/:childId/events",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(createChildEventSchema),
  createChildEvent
);
childHistoryRouter.patch(
  "/:childId/events/:eventId",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(updateChildEventSchema),
  updateChildEvent
);
childHistoryRouter.delete(
  "/:childId/events/:eventId",
  authMiddleware,
  dependentsWriteRateLimiter,
  deleteChildEvent
);
childHistoryRouter.put(
  "/:childId/academics",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(saveAcademicsSchema),
  saveChildAcademics
);

// Shares: the parent's own links. "preview" is before ":shareId" so it is never read as one.
childHistoryRouter.post(
  "/:childId/shares/preview",
  authMiddleware,
  validateRequest(previewShareSchema),
  previewShare
);
childHistoryRouter.post(
  "/:childId/shares",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(createShareSchema),
  createShare
);
childHistoryRouter.get("/:childId/shares", authMiddleware, listShares);
childHistoryRouter.get("/:childId/cv.pdf", authMiddleware, previewCv);
childHistoryRouter.delete(
  "/:childId/shares/:shareId",
  authMiddleware,
  dependentsWriteRateLimiter,
  revokeShare
);

childHistoryRouter.post(
  "/:childId/videos",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(startVideoUploadSchema),
  startVideoUpload
);
childHistoryRouter.post(
  "/:childId/videos/:videoId/complete",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(completeVideoUploadSchema),
  completeVideoUpload
);
childHistoryRouter.get("/:childId/videos/:videoId/playback", authMiddleware, getVideoPlayback);
childHistoryRouter.delete(
  "/:childId/videos/:videoId",
  authMiddleware,
  dependentsWriteRateLimiter,
  deleteVideo
);

export default childHistoryRouter;
