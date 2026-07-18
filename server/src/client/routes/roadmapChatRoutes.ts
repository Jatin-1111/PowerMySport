import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getRoadmapChat,
  sendRoadmapChatMessage,
  listRoadmapChatSessions,
  createRoadmapChatSession,
  getRoadmapChatSession,
  sendRoadmapChatSessionMessage,
} from "../controllers/roadmapChatController";
import { authMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const roadmapChatRouter = Router();

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

// ── Session-based routes (must be defined before /:sportSlug) ─────────────────
roadmapChatRouter.get("/sessions", authMiddleware, listRoadmapChatSessions);
roadmapChatRouter.post("/sessions", authMiddleware, createRoadmapChatSession);
roadmapChatRouter.get("/sessions/:sessionId", authMiddleware, getRoadmapChatSession);
roadmapChatRouter.post("/sessions/:sessionId", authMiddleware, chatBurstLimiter, sendRoadmapChatSessionMessage);

// ── Legacy sport-slug routes (backward compat) ────────────────────────────────
roadmapChatRouter.get("/:sportSlug", authMiddleware, getRoadmapChat);
roadmapChatRouter.post("/:sportSlug", authMiddleware, chatBurstLimiter, sendRoadmapChatMessage);

export default roadmapChatRouter;
