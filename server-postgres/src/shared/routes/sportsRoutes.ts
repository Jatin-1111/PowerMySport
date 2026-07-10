import { Router } from "express";
import {
  getAllSports,
  searchSports,
  verifySport,
  addCustomSport,
} from "../controller/sportsController";
import { authMiddleware } from "../../middleware/auth";
import { cacheResponse } from "../../middleware/cacheMiddleware";

const router = Router();

// Public routes (Cached for 1 hour since sports rarely change)
router.get("/", cacheResponse(3600), getAllSports);
router.get("/search", cacheResponse(3600), searchSports);
router.post("/verify", verifySport);

// Protected routes
router.post("/add", authMiddleware, addCustomSport);

export default router;
