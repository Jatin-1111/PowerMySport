import { Router } from "express";
import {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware,
} from "../../middleware/auth";
import * as expert from "../controllers/expertsController";

const router = Router();

// ── Admin (literal segments first so they aren't captured by /:expertId) ──────
router.post("/admin", authMiddleware, adminMiddleware, expert.createExpert);
router.get("/admin/all", authMiddleware, adminMiddleware, expert.listExpertsAdmin);
router.patch("/admin/:expertId", authMiddleware, adminMiddleware, expert.updateExpertAdmin);
router.patch("/admin/:expertId/active", authMiddleware, adminMiddleware, expert.setExpertActiveAdmin);
router.get("/admin/:expertId/sessions", authMiddleware, adminMiddleware, expert.expertSessionsAdmin);

// ── Expert self-service (literal /me before /:expertId) ───────────────────────
router.get("/me", authMiddleware, expert.getMyProfile);
router.patch("/me", authMiddleware, expert.updateMyProfile);

// ── Session routes (literal /sessions before /:expertId) ─────────────────────
router.get("/sessions/mine", authMiddleware, expert.mySessions);
router.get("/sessions/expert", authMiddleware, expert.expertSessions);
router.post("/sessions/:sessionId/reconcile", authMiddleware, expert.reconcileSession);
router.get("/sessions/:sessionId", authMiddleware, expert.getSession);
router.patch("/sessions/:sessionId/schedule", authMiddleware, expert.scheduleSession);
router.patch("/sessions/:sessionId/meeting-link", authMiddleware, expert.updateMeetingLink);
router.post("/sessions/:sessionId/complete", authMiddleware, expert.completeSession);
router.post("/sessions/:sessionId/cancel", authMiddleware, expert.cancelSession);
router.post("/sessions/:sessionId/review", authMiddleware, expert.reviewSession);
router.post("/sessions/:sessionId/refund-done", authMiddleware, adminMiddleware, expert.refundDoneAdmin);
router.post("/sessions/:sessionId/hide-review", authMiddleware, adminMiddleware, expert.hideReviewAdmin);

// ── Public discovery + booking ───────────────────────────────────────────────
router.get("/", optionalAuthMiddleware, expert.getExperts);
router.get("/:expertId", expert.getExpert);
router.get("/:expertId/reviews", expert.getReviews);
router.get("/:expertId/availability", expert.getAvailability);
router.post("/:expertId/sessions", authMiddleware, expert.initiateSession);

export default router;
