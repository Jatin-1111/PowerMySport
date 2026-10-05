import { Router } from "express";
import { getPlanner } from "../controllers/plannerController";
import { authMiddleware } from "../../middleware/auth";

const plannerRouter = Router();

// A planner is always about a profile this account owns: authenticated, and the
// service re-checks ownership rather than trusting the id in the path.
plannerRouter.get("/:dependentId", authMiddleware, getPlanner);

export default plannerRouter;
