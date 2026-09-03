import { Router } from "express";

import {
  addPathwayStage,
  createPathwayGuide,
  deletePathwayGuide,
  deletePathwayStage,
  getPathwayGuide,
  listPathwayGuides,
  reorderPathwayStages,
  setPathwayGuideStatus,
  updatePathwayGuide,
  updatePathwayStage,
} from "../controllers/pathwayGuideAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

// Every route is admin-only; reads need `pathways:view`, writes `pathways:manage`
// (which implies view — see utils/permissions.ts).
router.use(authMiddleware, adminMiddleware);

const canView = requirePermission("pathways:view");
const canManage = requirePermission("pathways:manage");

// ── Guides ──
router.get("/", canView, listPathwayGuides);
router.post("/", canManage, createPathwayGuide);
router.get("/:id", canView, getPathwayGuide);
router.put("/:id", canManage, updatePathwayGuide);
router.delete("/:id", canManage, deletePathwayGuide);
router.post("/:id/status", canManage, setPathwayGuideStatus);

// ── Stages ──
// "order" is registered before ":stageKey" so a reorder isn't read as a stage
// whose key happens to be "order".
router.put("/:id/stages/order", canManage, reorderPathwayStages);
router.post("/:id/stages", canManage, addPathwayStage);
router.put("/:id/stages/:stageKey", canManage, updatePathwayStage);
router.delete("/:id/stages/:stageKey", canManage, deletePathwayStage);

export default router;
