import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware,
} from "../../middleware/auth";
import * as expert from "../controllers/expertsController";

const router = Router();

// Payment-initiating and profile-mutating expert endpoints had no throttle at
// all — a gap on its own, and one that compounds every other fix in this
// file (e.g. repeatedly hammering session initiation or profile updates).
const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // max 10 session-booking attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many booking attempts. Please wait a moment and try again.",
  },
});

const expertMutationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // max 20 profile/session mutations per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please wait a moment and try again.",
  },
});

// ── Admin (literal segments first so they aren't captured by /:expertId) ──────
router.post("/admin", authMiddleware, adminMiddleware, expert.createExpert);
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  expert.listExpertsAdmin,
);
router.patch(
  "/admin/:expertId",
  authMiddleware,
  adminMiddleware,
  expert.updateExpertAdmin,
);
router.patch(
  "/admin/:expertId/active",
  authMiddleware,
  adminMiddleware,
  expert.setExpertActiveAdmin,
);
router.get(
  "/admin/:expertId/sessions",
  authMiddleware,
  adminMiddleware,
  expert.expertSessionsAdmin,
);
router.post(
  "/admin/:expertId/approve",
  authMiddleware,
  adminMiddleware,
  expert.approveExpertAdmin,
);
router.post(
  "/admin/:expertId/reject",
  authMiddleware,
  adminMiddleware,
  expert.rejectExpertAdmin,
);

// ── Expert self-service (literal /me before /:expertId) ───────────────────────
router.get("/me", authMiddleware, expert.getMyProfile);
router.patch(
  "/me",
  expertMutationRateLimiter,
  authMiddleware,
  expert.updateMyProfile,
);
router.post(
  "/me/review",
  expertMutationRateLimiter,
  authMiddleware,
  expert.submitForReview,
);

// ── Session routes (literal /sessions before /:expertId) ─────────────────────
router.get("/sessions/mine", authMiddleware, expert.mySessions);
router.get("/sessions/expert", authMiddleware, expert.expertSessions);
router.post(
  "/sessions/:sessionId/reconcile",
  authMiddleware,
  expert.reconcileSession,
);
router.get("/sessions/:sessionId", authMiddleware, expert.getSession);
router.get(
  "/sessions/:sessionId/player-detail",
  authMiddleware,
  expert.getSessionPlayerDetail,
);
router.patch(
  "/sessions/:sessionId/schedule",
  expertMutationRateLimiter,
  authMiddleware,
  expert.scheduleSession,
);
router.patch(
  "/sessions/:sessionId/meeting-link",
  expertMutationRateLimiter,
  authMiddleware,
  expert.updateMeetingLink,
);
router.post(
  "/sessions/:sessionId/complete",
  expertMutationRateLimiter,
  authMiddleware,
  expert.completeSession,
);
router.post(
  "/sessions/:sessionId/respond",
  expertMutationRateLimiter,
  authMiddleware,
  expert.respondSession,
);
router.post(
  "/sessions/:sessionId/cancel",
  expertMutationRateLimiter,
  authMiddleware,
  expert.cancelSession,
);
router.post(
  "/sessions/:sessionId/review",
  expertMutationRateLimiter,
  authMiddleware,
  expert.reviewSession,
);
router.post(
  "/sessions/:sessionId/refund-done",
  authMiddleware,
  adminMiddleware,
  expert.refundDoneAdmin,
);
router.post(
  "/sessions/:sessionId/hide-review",
  authMiddleware,
  adminMiddleware,
  expert.hideReviewAdmin,
);

// ── Public discovery + booking ───────────────────────────────────────────────
router.get("/", optionalAuthMiddleware, expert.getExperts);
router.get("/:expertId", expert.getExpert);
router.get("/:expertId/reviews", expert.getReviews);
router.get("/:expertId/availability", expert.getAvailability);
router.post(
  "/:expertId/sessions",
  bookingRateLimiter,
  authMiddleware,
  expert.initiateSession,
);

export default router;
