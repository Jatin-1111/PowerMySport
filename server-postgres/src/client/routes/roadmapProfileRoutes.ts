import { Router } from "express";
import {
  getRoadmapProfile,
  updateRoadmapProfile,
} from "../controllers/roadmapProfileController";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", getRoadmapProfile);
router.put("/", updateRoadmapProfile);

export default router;
