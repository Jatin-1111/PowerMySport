import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  listAssistantChatSessions,
  createAssistantChatSession,
  getAssistantChatSession,
  sendAssistantChatSessionMessage,
} from "../controllers/assistantChatController";
import { authMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const assistantChatRouter = Router();

const chatBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || "anon",
  store: createRedisRateLimitStore("rl:assistant-chat:burst:"),
  message: {
    success: false,
    message: "Too many messages. Please wait a moment before sending another.",
    code: "BURST_LIMIT_REACHED",
  },
  skip: (req) => !req.user,
});

assistantChatRouter.get("/sessions", authMiddleware, listAssistantChatSessions);
assistantChatRouter.post("/sessions", authMiddleware, createAssistantChatSession);
assistantChatRouter.get("/sessions/:sessionId", authMiddleware, getAssistantChatSession);
assistantChatRouter.post(
  "/sessions/:sessionId",
  authMiddleware,
  chatBurstLimiter,
  sendAssistantChatSessionMessage
);

export default assistantChatRouter;
