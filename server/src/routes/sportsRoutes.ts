import { Router } from "express";
import {
  getAllSports,
  searchSports,
  verifySport,
  addCustomSport,
} from "../controllers/sportsController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public routes
router.get("/", getAllSports);
router.get("/search", searchSports);
router.post("/verify", verifySport);

// Protected routes
router.post("/add", authMiddleware, addCustomSport);

export default router;
