import { Router } from "express";

import {
  dismissOpportunityLead,
  listOpportunityLeads,
  restoreOpportunityLead,
  runOpportunityDiscoveryNow,
  triageOpportunityLeadsNow,
  draftOpportunityLead,
} from "../controllers/opportunityLeadAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/", requirePermission("opportunities:view"), listOpportunityLeads);
router.post("/run", requirePermission("opportunities:manage"), runOpportunityDiscoveryNow);
router.post("/triage", requirePermission("opportunities:manage"), triageOpportunityLeadsNow);
router.post("/:id/restore", requirePermission("opportunities:manage"), restoreOpportunityLead);
router.post("/:id/draft", requirePermission("opportunities:manage"), draftOpportunityLead);
router.post("/:id/dismiss", requirePermission("opportunities:manage"), dismissOpportunityLead);

export default router;
