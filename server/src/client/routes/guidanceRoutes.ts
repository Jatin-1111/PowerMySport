import { Router } from "express";
import rateLimit from "express-rate-limit";
import { submitGuidance, getGuidanceHistory, deleteGuidance, downloadGuidanceReportPdf, recommendSport } from "../controllers/guidanceController";
import { getGuidanceChat, sendGuidanceChatMessage } from "../controllers/guidanceChatController";
import { authMiddleware, optionalAuthMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const guidanceRouter = Router();

// ── Guidance submission routes ────────────────────────────────────────────────
// POST uses optionalAuth so guests can generate guidance without an account.
// The controller handles `userId` being absent gracefully.
guidanceRouter.post("/", optionalAuthMiddleware, submitGuidance);
guidanceRouter.get("/", authMiddleware, getGuidanceHistory);
guidanceRouter.delete("/:id", authMiddleware, deleteGuidance);
guidanceRouter.get("/:id/report/pdf", optionalAuthMiddleware, downloadGuidanceReportPdf);

// ── Recommend Sport ───────────────────────────────────────────────────────────
guidanceRouter.post("/recommend-sport", optionalAuthMiddleware, recommendSport);

// ── Chat routes ───────────────────────────────────────────────────────────────
// Burst limiter: 10 requests/minute per user (§10)
const chatBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || "anon",
  store: createRedisRateLimitStore("rl:guidance-chat:burst:"),
  message: {
    success: false,
    message: "Too many messages. Please wait a moment before sending another.",
    code: "BURST_LIMIT_REACHED",
  },
  skip: (req) => !req.user, // Only rate-limit authenticated users (unauthenticated never reaches chat)
});

guidanceRouter.get("/:submissionId/chat", authMiddleware, getGuidanceChat);
guidanceRouter.post("/:submissionId/chat", authMiddleware, chatBurstLimiter, sendGuidanceChatMessage);

export default guidanceRouter;
