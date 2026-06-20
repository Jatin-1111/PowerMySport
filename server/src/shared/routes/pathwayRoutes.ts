import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getPathway,
  searchPathways,
  refreshPathway,
  refreshStalePathways,
  getPathwayStats,
} from "../controller/pathwayController";

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

// ── Public routes ─────────────────────────────────────────────────────────────

// GET /api/pathways/search?q=bad  (must come before / to avoid route conflict)
router.get("/search", pathwayRateLimiter, searchPathways);

// GET /api/pathways?sport=cricket&age=12&city=Mumbai
router.get("/", pathwayRateLimiter, getPathway);

// ── Admin / internal routes ───────────────────────────────────────────────────
// These require no extra middleware in development.
// In production, add role-check middleware (e.g. requireAdmin) before each.

// GET  /api/pathways/stats           — aggregate usage stats
router.get("/stats", getPathwayStats);

// POST /api/pathways/refresh         — force-refresh a single pathway
// Body: { cacheKey: string }
router.post("/refresh", refreshPathway);

// POST /api/pathways/refresh-stale   — refresh all stale pathways (runs in background)
router.post("/refresh-stale", refreshStalePathways);

export default router;
