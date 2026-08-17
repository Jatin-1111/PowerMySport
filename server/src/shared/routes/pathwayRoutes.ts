import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  getCuratedTournamentBySlug,
  getCuratedTournaments,
  getPathwayGuide,
  getPathwayStories,
  listPathwayQuestions,
  listPublishedPathwayGuides,
} from "../controller/pathwayController";

const router = Router();

const pathwayRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // plain reads of published content — no generation happens behind these
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many pathway requests. Please wait a moment and try again.",
  },
});

router.use(pathwayRateLimiter);

// ── The pathway itself ──
// "guides" is registered before "guide" only for readability; they don't collide.
router.get("/guides", listPublishedPathwayGuides);
router.get("/guide", getPathwayGuide);
// Answered questions across every published sport, for the `/roadmap` preview.
router.get("/questions", listPathwayQuestions);

// ── Neighbours that share this router ──
router.get("/stories", getPathwayStories);
router.get("/tournaments", getCuratedTournaments);
router.get("/tournaments/:slug", getCuratedTournamentBySlug);

export default router;
