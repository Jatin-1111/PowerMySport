import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  submitGuidance,
  getGuidanceHistory,
  deleteGuidance,
  downloadGuidanceReportPdf,
  redirectToWhatsApp,
  diagnoseGuidance,
} from "../controllers/guidanceController";
import { getGuidanceChat, sendGuidanceChatMessage } from "../controllers/guidanceChatController";
import { authMiddleware, optionalAuthMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore } from "../../middleware/rateLimit";

const guidanceRouter = Router();

// ── Guest daily cap ───────────────────────────────────────────────────────────
// Guidance, sport recommendation and the diagnosis each spend Gemini quota, and
// the key is shared with every other AI feature, so an anonymous caller must not
// be able to use it up for everyone. Signed-in parents are not counted here: they
// are limited elsewhere. Per IP and per endpoint, generous enough for a household
// behind one address (or a mobile carrier sharing one) to still get through.
const GUEST_DAILY_AI_LIMIT = 8;
const guestDailyLimiter = (prefix: string) =>
  rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: GUEST_DAILY_AI_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisRateLimitStore(prefix),
    skip: (req) => Boolean(req.user),
    message: {
      success: false,
      message:
        "You have used today's free tries. Create a free account to keep going, or come back tomorrow.",
      code: "GUEST_DAILY_LIMIT_REACHED",
    },
  });

// ── Guidance submission routes ────────────────────────────────────────────────
// POST uses optionalAuth so guests can generate guidance without an account.
// The controller handles `userId` being absent gracefully.
guidanceRouter.post(
  "/",
  optionalAuthMiddleware,
  guestDailyLimiter("rl:guidance:guest-day:"),
  submitGuidance
);
guidanceRouter.get("/", authMiddleware, getGuidanceHistory);
guidanceRouter.delete("/:id", authMiddleware, deleteGuidance);
guidanceRouter.get("/:id/report/pdf", optionalAuthMiddleware, downloadGuidanceReportPdf);
guidanceRouter.get("/:id/whatsapp", optionalAuthMiddleware, redirectToWhatsApp);

// ── Diagnosis confirmation ────────────────────────────────────────────────────
// Guests are the primary audience (runs before they've committed to an
// account), so this is keyed per-IP rather than per-user.
const diagnoseBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:guidance-diagnose:burst:"),
  message: {
    success: false,
    message: "Too many requests. Please wait a moment and try again.",
    code: "BURST_LIMIT_REACHED",
  },
});
guidanceRouter.post(
  "/diagnose",
  optionalAuthMiddleware,
  diagnoseBurstLimiter,
  guestDailyLimiter("rl:guidance-diagnose:guest-day:"),
  diagnoseGuidance
);

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
guidanceRouter.post(
  "/:submissionId/chat",
  authMiddleware,
  chatBurstLimiter,
  sendGuidanceChatMessage
);

export default guidanceRouter;
