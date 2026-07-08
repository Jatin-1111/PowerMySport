import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getPathway,
  getPathwayEntities,
  searchPathways,
  refreshPathway,
  refreshStalePathways,
  getPathwayStats,
  getPathwayStories,
  getPathwaysForExpertVerification,
  postPathwayExpertVerify,
  deletePathwayExpertVerify,
  getCuratedTournamentBySlug,
  getCuratedTournaments,
} from "../controller/pathwayController";
import { authMiddleware } from "../../middleware/auth";

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

// GET /api/pathways/stories?sport=cricket&level=2
router.get("/stories", pathwayRateLimiter, getPathwayStories);

// GET /api/pathways/tournaments          — list all curated tournaments (optionally filtered by ?sport=)
// GET /api/pathways/tournaments/:slug    — single curated tournament detail page data
router.get("/tournaments", pathwayRateLimiter, getCuratedTournaments);
router.get("/tournaments/:slug", pathwayRateLimiter, getCuratedTournamentBySlug);

// GET /api/pathways?sport=cricket&age=12&city=Mumbai
router.get("/", pathwayRateLimiter, getPathway);

// GET /api/pathways/entities?sport=cricket&city=Mumbai
// Fetches only tournaments/scholarships/universities — waits for scraper if needed.
// The client calls this in parallel with the main pathway request.
router.get("/entities", pathwayRateLimiter, getPathwayEntities);

// ── Expert verification routes ────────────────────────────────────────────────
// Verification is keyed by sportSlug, not a specific pathway document id —
// pathways are cached per-state, but an expert's credit applies sport-wide.

// GET /api/pathways/expert/mine — sports matching the logged-in expert's own profile
router.get("/expert/mine", authMiddleware, getPathwaysForExpertVerification);

// POST /api/pathways/expert/:sportSlug/verify — add/update this expert's verification credit
router.post(
  "/expert/:sportSlug/verify",
  authMiddleware,
  postPathwayExpertVerify,
);

// DELETE /api/pathways/expert/:sportSlug/verify — remove this expert's own verification credit
router.delete(
  "/expert/:sportSlug/verify",
  authMiddleware,
  deletePathwayExpertVerify,
);

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
