import { Router } from "express";

import { authMiddleware } from "../../middleware/auth";
import {
  followOpportunity,
  listFollows,
  unfollowOpportunity,
} from "../controller/opportunityFollowController";

// A parent's own follows, so every route needs a signed-in user.
const router = Router();
router.use(authMiddleware);

router.get("/", listFollows);
router.put("/:slug", followOpportunity);
router.delete("/:slug", unfollowOpportunity);

export default router;
