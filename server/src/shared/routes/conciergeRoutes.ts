import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import {
  getPresignedUploadUrl,
  submitConciergeRequest,
  getUserConciergeRequests,
} from "../controllers/ConciergeController";

const router = Router();

router.post("/presigned-url", authMiddleware, getPresignedUploadUrl);
router.post("/request", authMiddleware, submitConciergeRequest);
router.get("/requests", authMiddleware, getUserConciergeRequests);

export default router;
