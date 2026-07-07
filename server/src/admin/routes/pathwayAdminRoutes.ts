import { Router } from "express";
import {
  listPathwaysAdmin,
  getPathwayAdminDetail,
  updatePathwayAdmin,
  setPathwayVerifiedAdmin,
} from "../controllers/pathwayAdminController";
import {
  authMiddleware,
  adminMiddleware,
  requirePermission,
} from "../../middleware/auth";

const pathwayAdminRouter = Router();

pathwayAdminRouter.get(
  "/",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:view"),
  listPathwaysAdmin,
);

pathwayAdminRouter.get(
  "/:id",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:view"),
  getPathwayAdminDetail,
);

pathwayAdminRouter.patch(
  "/:id",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:manage"),
  updatePathwayAdmin,
);

pathwayAdminRouter.post(
  "/:id/verify",
  authMiddleware,
  adminMiddleware,
  requirePermission("pathways:manage"),
  setPathwayVerifiedAdmin,
);

export default pathwayAdminRouter;
