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

// ── Session routes (literal /sessions before /:expertId) ─────────────────────
router.get("/sessions/mine", authMiddleware, expert.mySessions);
router.get("/sessions/expert", authMiddleware, expert.expertSessions);
router.post("/sessions/:sessionId/reconcile", authMiddleware, expert.reconcileSession);
router.get("/sessions/:sessionId", authMiddleware, expert.getSession);
router.patch("/sessions/:sessionId/schedule", authMiddleware, expert.scheduleSession);
router.post("/sessions/:sessionId/complete", authMiddleware, expert.completeSession);
router.post("/sessions/:sessionId/review", authMiddleware, expert.reviewSession);

// ── Public discovery + booking ───────────────────────────────────────────────
router.get("/", optionalAuthMiddleware, expert.getExperts);
router.get("/:expertId", expert.getExpert);
router.get("/:expertId/reviews", expert.getReviews);
router.post("/:expertId/sessions", authMiddleware, expert.initiateSession);

export default router;
