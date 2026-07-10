import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getRoadmapChat,
  sendRoadmapChatMessage,
} from "../controllers/roadmapChatController";
import { authMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const roadmapChatRouter = Router();

// Burst limiter: 10 requests/minute per user, mirrors the guidance chat's burst guard.
const chatBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || "anon",
  store: createRedisRateLimitStore("rl:roadmap-chat:burst:"),
  message: {
    success: false,
    message: "Too many messages. Please wait a moment before sending another.",
    code: "BURST_LIMIT_REACHED",
  },
  skip: (req) => !req.user,
});

roadmapChatRouter.get("/:sportSlug", authMiddleware, getRoadmapChat);
roadmapChatRouter.post(
  "/:sportSlug",
  authMiddleware,
  chatBurstLimiter,
  sendRoadmapChatMessage,
);

export default roadmapChatRouter;
