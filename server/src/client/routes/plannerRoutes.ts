import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import {
  createRecommendations,
  getCosts,
  getPlanner,
  getRecommendations,
  putHomeCity,
} from "../controllers/plannerController";
import { authMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const plannerRouter = Router();

/**
 * A short-burst limit on asking for suggestions, separate from the daily
 * allowance of fresh answers. The daily allowance protects the model's quota;
 * this protects the server from a loop in a client, since a cached answer and a
 * rules-only answer cost no allowance and so would otherwise be unlimited.
 */
const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || (req.ip ? ipKeyGenerator(req.ip) : "anon"),
  store: createRedisRateLimitStore("rl:planner-suggest:"),
  message: {
    success: false,
    message: "Too many requests. Please wait a minute and try again.",
    code: "PLANNER_RATE_LIMITED",
  },
});

// A planner is always about a profile this account owns: authenticated, and the
// service re-checks ownership rather than trusting the id in the path.
plannerRouter.put("/home-city", authMiddleware, putHomeCity);
plannerRouter.get("/:dependentId", authMiddleware, getPlanner);
plannerRouter.get("/:dependentId/costs", authMiddleware, getCosts);
plannerRouter.get("/:dependentId/recommendations", authMiddleware, getRecommendations);
plannerRouter.post(
  "/:dependentId/recommendations",
  authMiddleware,
  suggestLimiter,
  createRecommendations
);

export default plannerRouter;
