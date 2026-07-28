import { Router } from "express";
import { getAllSports, searchSports } from "../controller/sportsController";
import { cacheResponse } from "../../middleware/cacheMiddleware";

const router = Router();

// Public routes (Cached for 1 hour since sports rarely change)
router.get("/", cacheResponse(3600), getAllSports);
router.get("/search", cacheResponse(3600), searchSports);

// "Add Custom Sport" (verify + add) is disabled for now — the sports
// directory is capped at the seeded list while we're restricted to the
// 10 supported sports. See sportsController.ts for the still-intact
// Gemini-verification implementation if this needs to be re-enabled later.

export default router;
