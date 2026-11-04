import { Router } from "express";
import {
  getPlanCheckIn,
  listPlanCheckIns,
  respondToPlanCheckIn,
  createFindSportTrialCheckIn,
  recordFindSportChoice,
} from "../controllers/planCheckInController";
import { authMiddleware } from "../../middleware/auth";

const planCheckInRouter = Router();

// Check-ins are only ever created for logged-in users (the nudge is an
// email), so all routes require auth — no guest/id-possession trust model
// here, unlike guidance's PDF/WhatsApp links.
planCheckInRouter.get("/", authMiddleware, listPlanCheckIns);
planCheckInRouter.post("/find-sport-trial", authMiddleware, createFindSportTrialCheckIn);
// Grouped with its sibling above rather than left below "/:id" — both are the
// find-sport trial lifecycle, and the literal path keeps them unambiguous.
planCheckInRouter.post("/find-sport-trial/choice", authMiddleware, recordFindSportChoice);
planCheckInRouter.get("/:id", authMiddleware, getPlanCheckIn);
planCheckInRouter.post("/:id/respond", authMiddleware, respondToPlanCheckIn);

export default planCheckInRouter;
