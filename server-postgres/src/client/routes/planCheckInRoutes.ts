import { Router } from "express";
import {
  getPlanCheckIn,
  listPlanCheckIns,
  respondToPlanCheckIn,
  createFindSportTrialCheckIn,
} from "../controllers/planCheckInController";
import { authMiddleware } from "../../middleware/auth";

const planCheckInRouter = Router();

// Check-ins are only ever created for logged-in users (the nudge is an
// email), so all routes require auth — no guest/id-possession trust model
// here, unlike guidance's PDF/WhatsApp links.
planCheckInRouter.get("/", authMiddleware, listPlanCheckIns);
planCheckInRouter.post(
  "/find-sport-trial",
  authMiddleware,
  createFindSportTrialCheckIn,
);
planCheckInRouter.get("/:id", authMiddleware, getPlanCheckIn);
planCheckInRouter.post("/:id/respond", authMiddleware, respondToPlanCheckIn);

export default planCheckInRouter;
