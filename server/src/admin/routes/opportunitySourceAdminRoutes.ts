import { Router } from "express";

import {
  approveOpportunitySource,
  createOpportunitySource,
  getAutoApprovalStatus,
  getOpportunitySource,
  getOpportunitySourceUploadUrl,
  listOpportunitySources,
  reExtractOpportunitySource,
  rejectOpportunitySource,
  revertAutoApprovedSource,
  updateOpportunitySource,
} from "../controllers/opportunitySourceAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

// Admissions & scholarships read from a link or PDF. Mounted at its own path
// (/api/admin/opportunity-sources) rather than under /opportunities, where
// "sources" would be read as an entry id.
const router = Router();

router.use(authMiddleware, adminMiddleware);

const canView = requirePermission("opportunities:view");
const canManage = requirePermission("opportunities:manage");

router.post("/upload-url", canManage, getOpportunitySourceUploadUrl);
router.get("/", canView, listOpportunitySources);
router.get("/auto-approval", canView, getAutoApprovalStatus);
router.post("/", canManage, createOpportunitySource);
router.get("/:id", canView, getOpportunitySource);
router.patch("/:id", canManage, updateOpportunitySource);
router.post("/:id/re-extract", canManage, reExtractOpportunitySource);
router.post("/:id/reject", canManage, rejectOpportunitySource);
router.post("/:id/approve", canManage, approveOpportunitySource);
router.post("/:id/revert-auto", canManage, revertAutoApprovedSource);

export default router;
