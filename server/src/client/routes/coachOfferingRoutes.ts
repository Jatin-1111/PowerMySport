import { Router } from "express";
import { authMiddleware } from "../../middleware/auth";
import { validateRequest } from "../../middleware/validation";
import { cacheResponse } from "../../middleware/cacheMiddleware";
import { cacheControl } from "../../middleware/cacheControl";
import {
  coachAttendanceSchema,
  coachEnrollSchema,
  coachMakeupSchema,
  coachMeetingLinkSchema,
  coachSessionCancelSchema,
  coachSessionCompleteSchema,
  coachWaitlistSchema,
  createCoachOfferingSchema,
} from "../../middleware/schemas";
import {
  activateOfferingHandler,
  browseOfferingsHandler,
  cancelSessionHandler,
  coachSessionEarningsHandler,
  completeSessionHandler,
  createOfferingHandler,
  enrollHandler,
  leaveEnrollmentHandler,
  listMyOfferingsHandler,
  listMySessionsHandler,
  markAttendanceHandler,
  myEnrollmentsHandler,
  myUpcomingSessionsHandler,
  myWaitlistHandler,
  joinWaitlistHandler,
  leaveWaitlistHandler,
  offeringWaitlistHandler,
  renewEnrollmentHandler,
  offeringRosterHandler,
  outstandingMakeupsHandler,
  pauseOfferingHandler,
  scheduleMakeupHandler,
  setOfferingLinkHandler,
  setSessionLinkHandler,
} from "../controllers/coachOfferingController";

/**
 * Recurring coaching programmes.
 *
 * Mounted on its own path rather than under /api/coaches because that router
 * ends in a `/:coachId` catch-all, which would swallow every literal segment
 * added after it.
 *
 * Route order here matters too: the literal `/mine`, `/browse` and `/sessions`
 * paths are declared before any parameterised route that could match them.
 */
const router = Router();

// ── public ──────────────────────────────────────────────────────────────────
// The non-geographic discovery lane. Coach `/discover` is a $geoNear and an
// online-only coach has no base location, so they can only be found here.
// public: never reads req.user or embeds a per-viewer field.
router.get("/browse", cacheControl(60, "public"), cacheResponse(60), browseOfferingsHandler);

// ── student ─────────────────────────────────────────────────────────────────
router.get("/my/enrollments", authMiddleware, myEnrollmentsHandler);
router.get("/my/sessions", authMiddleware, myUpcomingSessionsHandler);
router.post(
  "/:offeringId/enroll",
  authMiddleware,
  validateRequest(coachEnrollSchema),
  enrollHandler
);
router.post("/enrollments/:enrollmentId/leave", authMiddleware, leaveEnrollmentHandler);
router.post("/enrollments/:enrollmentId/renew", authMiddleware, renewEnrollmentHandler);
router.get("/my/waitlist", authMiddleware, myWaitlistHandler);
router.post(
  "/:offeringId/waitlist",
  authMiddleware,
  validateRequest(coachWaitlistSchema),
  joinWaitlistHandler
);
router.post("/waitlist/:entryId/leave", authMiddleware, leaveWaitlistHandler);

// ── coach: programmes ───────────────────────────────────────────────────────
router.get("/mine", authMiddleware, listMyOfferingsHandler);
router.post("/", authMiddleware, validateRequest(createCoachOfferingSchema), createOfferingHandler);
router.post("/:offeringId/activate", authMiddleware, activateOfferingHandler);
router.post("/:offeringId/pause", authMiddleware, pauseOfferingHandler);
router.get("/:offeringId/roster", authMiddleware, offeringRosterHandler);
router.get("/:offeringId/waitlist", authMiddleware, offeringWaitlistHandler);
router.put(
  "/:offeringId/meeting-link",
  authMiddleware,
  validateRequest(coachMeetingLinkSchema),
  setOfferingLinkHandler
);

// ── coach: sessions ─────────────────────────────────────────────────────────
router.get("/sessions/mine", authMiddleware, listMySessionsHandler);
router.get("/sessions/makeups-owed", authMiddleware, outstandingMakeupsHandler);
router.get("/sessions/earnings", authMiddleware, coachSessionEarningsHandler);
router.post(
  "/sessions/:occurrenceId/complete",
  authMiddleware,
  validateRequest(coachSessionCompleteSchema),
  completeSessionHandler
);
router.post(
  "/sessions/:occurrenceId/cancel",
  authMiddleware,
  validateRequest(coachSessionCancelSchema),
  cancelSessionHandler
);
router.post(
  "/sessions/:occurrenceId/makeup",
  authMiddleware,
  validateRequest(coachMakeupSchema),
  scheduleMakeupHandler
);
router.post(
  "/sessions/:occurrenceId/attendance",
  authMiddleware,
  validateRequest(coachAttendanceSchema),
  markAttendanceHandler
);
router.put(
  "/sessions/:occurrenceId/meeting-link",
  authMiddleware,
  validateRequest(coachMeetingLinkSchema),
  setSessionLinkHandler
);

export default router;
