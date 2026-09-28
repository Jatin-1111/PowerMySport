import { Router } from "express";

import {
  dismissOpportunityLead,
  listOpportunityLeads,
  runOpportunityDiscoveryNow,
} from "../controllers/opportunityLeadAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/", requirePermission("opportunities:view"), listOpportunityLeads);
router.post("/run", requirePermission("opportunities:manage"), runOpportunityDiscoveryNow);
router.post("/:id/dismiss", requirePermission("opportunities:manage"), dismissOpportunityLead);

export default router;
