import { Router } from "express";

import {
  deleteStageGuideAdmin,
  getStageGuideAdmin,
  listStageGuidesAdmin,
  upsertStageGuideAdmin,
  validateStageGuideAdmin,
} from "../controllers/stageGuideAdminController";
import {
  adminMiddleware,
  authMiddleware,
  requirePermission,
} from "../../middleware/auth";

const stageGuideAdminRouter = Router();

// GET /api/admin/stage-guides
stageGuideAdminRouter.get(
  "/",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:view"),
  listStageGuidesAdmin,
);

// POST /api/admin/stage-guides/validate — dry run, writes nothing.
// Registered before /:sportSlug so "validate" isn't read as a sport.
stageGuideAdminRouter.post(
  "/validate",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:view"),
  validateStageGuideAdmin,
);

// PUT /api/admin/stage-guides — upsert by sport (+ optional ?state)
stageGuideAdminRouter.put(
  "/",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:manage"),
  upsertStageGuideAdmin,
);

// GET /api/admin/stage-guides/:sportSlug?state=delhi
stageGuideAdminRouter.get(
  "/:sportSlug",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:view"),
  getStageGuideAdmin,
);

// DELETE /api/admin/stage-guides/:sportSlug?state=delhi
stageGuideAdminRouter.delete(
  "/:sportSlug",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:manage"),
  deleteStageGuideAdmin,
);

export default stageGuideAdminRouter;
