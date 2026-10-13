import { Router } from "express";

import {
  dismissOpportunityWatch,
  listOpportunityWatches,
  manualCheckOpportunityWatch,
  runOpportunityWatchNow,
} from "../controllers/opportunityWatchAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/", requirePermission("opportunities:view"), listOpportunityWatches);
router.post("/run", requirePermission("opportunities:manage"), runOpportunityWatchNow);
router.post(
  "/:id/manual-check",
  requirePermission("opportunities:manage"),
  manualCheckOpportunityWatch
);
router.post("/:id/dismiss", requirePermission("opportunities:manage"), dismissOpportunityWatch);

export default router;
