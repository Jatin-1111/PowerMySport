import { Router } from "express";
import {
  addSeasonPlanEntry,
  getSeasonPlan,
  removeSeasonPlanEntry,
  updateSeasonPlanEntry,
} from "../controllers/seasonPlanController";
import { authMiddleware } from "../../middleware/auth";

const seasonPlanRouter = Router();

// A plan is always about a profile this account owns, so every route is
// authenticated and every handler re-checks that ownership rather than
// trusting the id in the path.
seasonPlanRouter.get("/:dependentId", authMiddleware, getSeasonPlan);
seasonPlanRouter.post("/:dependentId/entries", authMiddleware, addSeasonPlanEntry);
seasonPlanRouter.patch("/:dependentId/entries/:editionSlug", authMiddleware, updateSeasonPlanEntry);
seasonPlanRouter.delete(
  "/:dependentId/entries/:editionSlug",
  authMiddleware,
  removeSeasonPlanEntry
);

export default seasonPlanRouter;
