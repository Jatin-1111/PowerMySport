import { Router } from "express";
import { getPathway, searchPathways } from "../controller/pathwayController";

const router = Router();

// GET /api/pathways/search?q=bad  (must come before /:sport)
router.get("/search", searchPathways);

// GET /api/pathways?sport=cricket
router.get("/", getPathway);

export default router;
