import { Router } from "express";
import {
  createScreeningRequest,
  getMyScreeningRequests,
  getScreeningRequests,
  updateScreeningStatus,
} from "../controllers/screeningController";
import { authMiddleware, adminMiddleware, optionalAuthMiddleware } from "../../middleware/auth";

const screeningRouter = Router();

// Public — guests and logged-in parents can submit
screeningRouter.post("/", optionalAuthMiddleware, createScreeningRequest);

// Logged-in parent's own requests — used by the journey UI to detect a real booking
screeningRouter.get("/mine", authMiddleware, getMyScreeningRequests);

// Admin
screeningRouter.get("/admin", authMiddleware, adminMiddleware, getScreeningRequests);
screeningRouter.patch("/admin/:id/status", authMiddleware, adminMiddleware, updateScreeningStatus);

export default screeningRouter;
