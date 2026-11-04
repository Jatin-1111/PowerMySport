import { Router } from "express";
import {
  addSeasonPlanEntry,
  dismissSeasonPlanEvent,
  getSeasonPlan,
  removeSeasonPlanEntry,
  restoreSeasonPlanEvent,
  setSeasonPlanPreferences,
  updateSeasonPlanEntry,
} from "../controllers/seasonPlanController";
import { authMiddleware } from "../../middleware/auth";

const seasonPlanRouter = Router();

// A plan is always about a profile this account owns, so every route is
// authenticated and every handler re-checks that ownership rather than
// trusting the id in the path.
seasonPlanRouter.get("/:dependentId", authMiddleware, getSeasonPlan);
seasonPlanRouter.put("/:dependentId/preferences", authMiddleware, setSeasonPlanPreferences);
seasonPlanRouter.post("/:dependentId/entries", authMiddleware, addSeasonPlanEntry);
seasonPlanRouter.patch("/:dependentId/entries/:editionSlug", authMiddleware, updateSeasonPlanEntry);
seasonPlanRouter.delete(
  "/:dependentId/entries/:editionSlug",
  authMiddleware,
  removeSeasonPlanEntry
);

seasonPlanRouter.post("/:dependentId/dismissed", authMiddleware, dismissSeasonPlanEvent);
seasonPlanRouter.delete(
  "/:dependentId/dismissed/:editionSlug",
  authMiddleware,
  restoreSeasonPlanEvent
);

export default seasonPlanRouter;
