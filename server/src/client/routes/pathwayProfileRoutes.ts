import { Router } from "express";
import {
  getPathwayProfile,
  updatePathwayProfile,
} from "../controllers/pathwayProfileController";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.get("/", getPathwayProfile);
router.put("/", updatePathwayProfile);

export default router;
