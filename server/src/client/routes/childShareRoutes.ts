import { NextFunction, Request, Response, Router } from "express";
import {
  downloadSharedCv,
  openSharedProfile,
  playSharedVideo,
  requestContact,
} from "../controllers/childShareController";
import {
  contactRequestRateLimiter,
  publicShareRateLimiter,
  publicShareTokenRateLimiter,
} from "../../middleware/rateLimit";
import { validateRequest } from "../../middleware/validation";
import { contactRequestSchema } from "../services/ChildHistoryService/schemas";

/**
 * The public side of a shared profile: no sign-in, so everything about who may call it is the
 * token in the path and the limits here.
 *
 * Every response says it is private: not to be cached by a browser or a proxy (a revoked link
 * must stop working at once, and a signed video link is a credential for a few minutes), not to
 * be indexed, and not to pass the address on to other sites through the Referer header.
 */
const childShareRouter = Router();

childShareRouter.use((_req: Request, res: Response, next: NextFunction) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
  });
  next();
});

childShareRouter.get(
  "/:token",
  publicShareRateLimiter,
  publicShareTokenRateLimiter,
  openSharedProfile
);
childShareRouter.get(
  "/:token/cv.pdf",
  publicShareRateLimiter,
  publicShareTokenRateLimiter,
  downloadSharedCv
);
childShareRouter.post(
  "/:token/contact",
  publicShareRateLimiter,
  publicShareTokenRateLimiter,
  contactRequestRateLimiter,
  validateRequest(contactRequestSchema),
  requestContact
);
childShareRouter.get(
  "/:token/videos/:videoId/playback",
  publicShareRateLimiter,
  publicShareTokenRateLimiter,
  playSharedVideo
);

export default childShareRouter;
