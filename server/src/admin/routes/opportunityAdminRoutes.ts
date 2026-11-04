import { Router } from "express";

import {
  checkAdminOpportunity,
  createAdminOpportunity,
  deleteAdminOpportunity,
  getAdminOpportunity,
  getOpportunityQueueSummary,
  listAdminOpportunities,
  setAdminOpportunityStatus,
  updateAdminOpportunity,
  verifyAdminOpportunity,
} from "../controllers/opportunityAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

// Every route is admin-only; reads need `opportunities:view`, writes
// `opportunities:manage` (which implies view — see utils/permissions.ts).
router.use(authMiddleware, adminMiddleware);

const canView = requirePermission("opportunities:view");
const canManage = requirePermission("opportunities:manage");

router.get("/", canView, listAdminOpportunities);
router.post("/", canManage, createAdminOpportunity);
// Before "/:id", or "queue-summary" would be read as an id.
router.get("/queue-summary", canView, getOpportunityQueueSummary);
router.get("/:id", canView, getAdminOpportunity);
router.put("/:id", canManage, updateAdminOpportunity);
router.delete("/:id", canManage, deleteAdminOpportunity);
router.post("/:id/status", canManage, setAdminOpportunityStatus);
router.post("/:id/check", canManage, checkAdminOpportunity);
router.post("/:id/verify", canManage, verifyAdminOpportunity);

export default router;
