import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getPathway, searchPathways } from "../controller/pathwayController";

const router = Router();

const pathwayRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8, // max 8 pathway lookups per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many pathway requests. Please wait a moment and try again.",
  },
});

// GET /api/pathways/search?q=bad  (must come before /:sport)
router.get("/search", pathwayRateLimiter, searchPathways);

// GET /api/pathways?sport=cricket
router.get("/", pathwayRateLimiter, getPathway);

export default router;
