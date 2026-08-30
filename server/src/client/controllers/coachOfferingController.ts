import { Request, Response } from "express";
import mongoose from "mongoose";
import { Coach } from "../models/Coach";
import { CoachOffering } from "../models/CoachOffering";
import { CoachEnrollment } from "../models/CoachEnrollment";
import { CoachSessionOccurrence } from "../models/CoachSessionOccurrence";
import { CoachSubscriptionPackage } from "../models/CoachSubscriptionPackage";
import {
  activateOffering,
  cancelEnrollment,
  createOffering,
  pauseOffering,
  reserveEnrollmentSeat,
  rosterForOffering,
} from "../services/CoachOfferingService";
import { initiateSubscriptionCheckout } from "../services/CoachSubscriptionCheckoutService";
import {
  setOccurrenceMeetingLink,
  setOfferingMeetingLink,
} from "../services/CoachOccurrenceService";
import {
  cancelOccurrenceByCoach,
  coachEarningsSummary,
  coachReliabilitySummary,
  completeOccurrence,
  markAttendance,
  outstandingMakeups,
  scheduleMakeup,
} from "../services/CoachSessionLifecycleService";
import { creditSummaryForEnrollment } from "../services/CoachCreditLedgerService";
import { renewalTargetForEnrollment } from "../services/CoachRenewalService";
import { refundUnusedCreditsForEnrollment } from "../services/CoachEnrollmentRefundService";
import {
  convertWaitlistEntry,
  joinWaitlist,
  leaveWaitlist,
  waitlistEntriesForUser,
  waitlistForOffering,
} from "../services/CoachWaitlistService";
import { transformDocuments } from "../../middleware/responseTransform";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachOfferingController");

/**
 * HTTP surface for recurring coaching programmes.
 *
 * Every coach-facing handler resolves the caller's OWN coach profile and scopes
 * the query to it — an id in the URL is never trusted as authorisation. That is
 * enforced by `requireOwnCoach` below rather than repeated per handler, so a new
 * endpoint cannot forget it.
 */

const fail = (res: Response, status: number, message: string): void => {
  res.status(status).json({ success: false, message });
};

const ok = (res: Response, message: string, data?: unknown): void => {
  res.status(200).json({ success: true, message, ...(data ? { data } : {}) });
};

/** The signed-in user's coach profile, or null after writing the response. */
const requireOwnCoach = async (req: Request, res: Response) => {
  if (!req.user?.id || req.user.role !== "Coach") {
    fail(res, 403, "Coach role required");
    return null;
  }
  const coach = await Coach.findOne({ userId: req.user.id });
  if (!coach) {
    fail(res, 404, "Coach profile not found");
    return null;
  }
  return coach;
};

const asObjectId = (value: string): mongoose.Types.ObjectId | null =>
  mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

/**
 * Load an offering the caller owns. Returns null (response already written)
 * when it does not exist or belongs to someone else — deliberately the same
 * 404 in both cases, so the endpoint cannot be used to probe for ids.
 */
const ownedOffering = async (
  res: Response,
  coachId: mongoose.Types.ObjectId,
  offeringId: string,
) => {
  const id = asObjectId(offeringId);
  if (!id) {
    fail(res, 400, "Invalid offering ID");
    return null;
  }
  const offering = await CoachOffering.findOne({ _id: id, coachId });
  if (!offering) {
    fail(res, 404, "Offering not found");
    return null;
  }
  return offering;
};

const ownedOccurrence = async (
  res: Response,
  coachId: mongoose.Types.ObjectId,
  occurrenceId: string,
) => {
  const id = asObjectId(occurrenceId);
  if (!id) {
    fail(res, 400, "Invalid session ID");
    return null;
  }
  const occurrence = await CoachSessionOccurrence.findOne({ _id: id, coachId });
  if (!occurrence) {
    fail(res, 404, "Session not found");
    return null;
  }
  return occurrence;
};

// ───────────────── offerings ─────────────────

export const createOfferingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;

    const packageId = asObjectId(req.body.packageId);
    if (!packageId) {
      fail(res, 400, "A valid billing package is required");
      return;
    }

    const offering = await createOffering({
      coachId: coach._id as mongoose.Types.ObjectId,
      sport: req.body.sport,
      title: req.body.title,
      description: req.body.description,
      deliveryKind: req.body.deliveryKind,
      ...(req.body.venueId ? { venueId: asObjectId(req.body.venueId)! } : {}),
      onlinePlatform: req.body.onlinePlatform,
      defaultMeetingLink: req.body.defaultMeetingLink,
      capacity: req.body.capacity,
      schedule: req.body.schedule,
      timezone: req.body.timezone,
      packageId,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
    });

    res.status(201).json({
      success: true,
      message: "Programme created",
      data: { offering },
    });
  } catch (error) {
    log.error("createOfferingHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const listMyOfferingsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;

    const offerings = await CoachOffering.find({ coachId: coach._id })
      .sort({ createdAt: -1 })
      .lean();

    ok(res, "Programmes retrieved", {
      offerings: transformDocuments(offerings),
    });
  } catch (error) {
    log.error("listMyOfferingsHandler failed:", error);
    fail(res, 500, "Failed to load programmes");
  }
};

export const activateOfferingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const offering = await ownedOffering(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.offeringId as string,
    );
    if (!offering) return;

    const result = await activateOffering({
      offeringId: offering._id as mongoose.Types.ObjectId,
    });

    ok(res, `Programme published — ${result.created} session(s) scheduled`, {
      offering: result.offering,
      sessionsCreated: result.created,
    });
  } catch (error) {
    log.error("activateOfferingHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const pauseOfferingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const offering = await ownedOffering(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.offeringId as string,
    );
    if (!offering) return;

    const result = await pauseOffering({
      offeringId: offering._id as mongoose.Types.ObjectId,
    });

    ok(res, `Programme paused — ${result.removed} upcoming session(s) removed`, {
      offering: result.offering,
    });
  } catch (error) {
    log.error("pauseOfferingHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const offeringRosterHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const offering = await ownedOffering(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.offeringId as string,
    );
    if (!offering) return;

    const roster = await rosterForOffering(
      offering._id as mongoose.Types.ObjectId,
    );

    ok(res, "Roster retrieved", {
      roster: transformDocuments(roster as any),
      capacity: offering.capacity,
      enrolledCount: offering.enrolledCount,
      seatsLeft: Math.max(0, offering.capacity - offering.enrolledCount),
    });
  } catch (error) {
    log.error("offeringRosterHandler failed:", error);
    fail(res, 500, "Failed to load roster");
  }
};

// ───────────────── sessions ─────────────────

export const listMySessionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;

    const from = req.query.from
      ? new Date(String(req.query.from))
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date(Date.now() + 56 * 24 * 60 * 60 * 1000);

    const sessions = await CoachSessionOccurrence.find({
      coachId: coach._id,
      scheduledAt: { $gte: from, $lte: to },
    })
      .sort({ scheduledAt: 1 })
      .lean();

    ok(res, "Sessions retrieved", { sessions: transformDocuments(sessions) });
  } catch (error) {
    log.error("listMySessionsHandler failed:", error);
    fail(res, 500, "Failed to load sessions");
  }
};

export const completeSessionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const occurrence = await ownedOccurrence(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.occurrenceId as string,
    );
    if (!occurrence) return;

    const result = await completeOccurrence({
      occurrenceId: occurrence._id as mongoose.Types.ObjectId,
      coachNotes: req.body?.coachNotes,
    });

    ok(res, "Session completed", {
      session: result.occurrence,
      seatsFunded: result.seatsFunded,
      seatsUnfunded: result.seatsUnfunded,
      earnedPaise: result.amountPaise,
    });
  } catch (error) {
    log.error("completeSessionHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const cancelSessionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const occurrence = await ownedOccurrence(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.occurrenceId as string,
    );
    if (!occurrence) return;

    const updated = await cancelOccurrenceByCoach({
      occurrenceId: occurrence._id as mongoose.Types.ObjectId,
      reason: req.body?.reason,
    });

    ok(
      res,
      "Session cancelled — your students keep their session credit and are owed a makeup",
      { session: updated },
    );
  } catch (error) {
    log.error("cancelSessionHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const scheduleMakeupHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const occurrence = await ownedOccurrence(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.occurrenceId as string,
    );
    if (!occurrence) return;

    const makeup = await scheduleMakeup({
      cancelledOccurrenceId: occurrence._id as mongoose.Types.ObjectId,
      scheduledAt: new Date(req.body.scheduledAt),
      durationMinutes: req.body.durationMinutes,
    });

    res.status(201).json({
      success: true,
      message: "Makeup session scheduled",
      data: { session: makeup },
    });
  } catch (error) {
    log.error("scheduleMakeupHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const outstandingMakeupsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;

    const sessions = await outstandingMakeups({
      coachId: coach._id as mongoose.Types.ObjectId,
    });

    ok(res, "Outstanding makeups retrieved", {
      sessions: transformDocuments(sessions as any),
    });
  } catch (error) {
    log.error("outstandingMakeupsHandler failed:", error);
    fail(res, 500, "Failed to load outstanding makeups");
  }
};

export const markAttendanceHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const occurrence = await ownedOccurrence(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.occurrenceId as string,
    );
    if (!occurrence) return;

    const enrollmentId = asObjectId(req.body.enrollmentId);
    if (!enrollmentId) {
      fail(res, 400, "Invalid enrollment ID");
      return;
    }

    const updated = await markAttendance({
      occurrenceId: occurrence._id as mongoose.Types.ObjectId,
      enrollmentId,
      mark: req.body.mark,
    });

    ok(res, "Attendance recorded", { session: updated });
  } catch (error) {
    log.error("markAttendanceHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

// ───────────────── online links ─────────────────

export const setSessionLinkHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const occurrence = await ownedOccurrence(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.occurrenceId as string,
    );
    if (!occurrence) return;

    const updated = await setOccurrenceMeetingLink({
      occurrenceId: occurrence._id as mongoose.Types.ObjectId,
      meetingLink: req.body.meetingLink,
    });

    ok(res, "Class link updated", { session: updated });
  } catch (error) {
    log.error("setSessionLinkHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const setOfferingLinkHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const offering = await ownedOffering(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.offeringId as string,
    );
    if (!offering) return;

    const result = await setOfferingMeetingLink({
      offeringId: offering._id as mongoose.Types.ObjectId,
      meetingLink: req.body.meetingLink,
    });

    ok(
      res,
      `Class link updated on ${result.updatedSessions} upcoming session(s)`,
      { offering: result.offering },
    );
  } catch (error) {
    log.error("setOfferingLinkHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

// ───────────────── earnings ─────────────────

export const coachSessionEarningsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;

    const [summary, reliability] = await Promise.all([
      coachEarningsSummary(coach._id as mongoose.Types.ObjectId),
      // Shown to the coach alongside their money, deliberately: the count is
      // there to inform them, not to catch them out.
      coachReliabilitySummary({ coachId: coach._id as mongoose.Types.ObjectId }),
    ]);

    ok(res, "Earnings retrieved", { summary, reliability });
  } catch (error) {
    log.error("coachSessionEarningsHandler failed:", error);
    fail(res, 500, "Failed to load earnings");
  }
};

// ───────────────── student-facing ─────────────────

/**
 * Start enrolling: hold a seat, then send the payer to the gateway.
 *
 * Nothing about the enrolment becomes real here — no credits, no roster place.
 * The seat is held so the payer cannot lose it mid-checkout, and the enrolment
 * goes live only when the payment reconciles (see
 * CoachSubscriptionPaymentService.applySubscriptionActivation). If the payer
 * abandons the checkout the hold expires and the seat returns.
 */
export const enrollHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  let heldEnrollmentId: mongoose.Types.ObjectId | null = null;

  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in to enroll");
      return;
    }

    const offeringId = asObjectId(req.params.offeringId as string);
    if (!offeringId) {
      fail(res, 400, "Invalid offering ID");
      return;
    }

    const offering = await CoachOffering.findById(offeringId);
    if (!offering || offering.status !== "ACTIVE") {
      fail(res, 404, "Programme not found or not open for enrolment");
      return;
    }

    const pkg = await CoachSubscriptionPackage.findById(offering.packageId);
    if (!pkg || !pkg.isActive) {
      fail(res, 409, "This programme has no active price set");
      return;
    }

    const enrollment = await reserveEnrollmentSeat({
      offeringId,
      userId: new mongoose.Types.ObjectId(req.user.id),
      playerId: req.body.playerId ? asObjectId(req.body.playerId) : null,
      studentName: req.body.studentName,
      deliveryAddress: req.body.deliveryAddress ?? null,
    });
    heldEnrollmentId = enrollment._id as mongoose.Types.ObjectId;

    // They got in — stop telling them about free seats.
    await convertWaitlistEntry({
      offeringId,
      userId: new mongoose.Types.ObjectId(req.user.id),
      playerId: req.body.playerId ? asObjectId(req.body.playerId) : null,
    });

    // Price comes from the package, never the request body.
    const checkout = await initiateSubscriptionCheckout({
      userId: req.user.id,
      coachId: offering.coachId.toString(),
      packageId: offering.packageId.toString(),
      ...(req.body.playerId ? { dependentId: req.body.playerId } : {}),
      offeringId,
      enrollmentId: enrollment._id as mongoose.Types.ObjectId,
      redirectType: "programme",
    });

    res.status(201).json({
      success: true,
      message: "Seat held — complete payment to confirm",
      data: {
        enrollmentId: enrollment._id.toString(),
        holdExpiresAt: enrollment.holdExpiresAt,
        redirectUrl: checkout.redirectUrl,
        merchantOrderId: checkout.merchantOrderId,
        amountBreakdown: checkout.amountBreakdown,
      },
    });
  } catch (error) {
    // If the seat was held but checkout failed, release it now rather than
    // making the student wait out the hold for a payment that never started.
    if (heldEnrollmentId) {
      await releaseHeldSeat(heldEnrollmentId).catch(() => undefined);
    }
    log.error("enrollHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

/** Undo a seat hold whose checkout never got off the ground. */
const releaseHeldSeat = async (
  enrollmentId: mongoose.Types.ObjectId,
): Promise<void> => {
  const claimed = await CoachEnrollment.findOneAndUpdate(
    { _id: enrollmentId, status: "PENDING" },
    {
      $set: {
        status: "CANCELLED",
        leftAt: new Date(),
        cancellationReason: "Checkout could not be started",
      },
    },
  );
  if (!claimed) return;

  await CoachOffering.findByIdAndUpdate(claimed.offeringId, {
    $inc: { enrolledCount: -1 },
  });
};

export const myEnrollmentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in to view your programmes");
      return;
    }

    const enrollments = await CoachEnrollment.find({
      userId: req.user.id,
      status: { $in: ["ACTIVE", "PENDING", "PAUSED"] },
    })
      .populate("offeringId")
      .lean();

    // The ledger balance is what a parent actually wants to see: how many
    // classes are left, not how much time has elapsed.
    const withCredits = await Promise.all(
      transformDocuments(enrollments).map(async (enrollment: any) => ({
        ...enrollment,
        credits: await creditSummaryForEnrollment(enrollment._id),
      })),
    );

    ok(res, "Programmes retrieved", { enrollments: withCredits });
  } catch (error) {
    log.error("myEnrollmentsHandler failed:", error);
    fail(res, 500, "Failed to load your programmes");
  }
};

export const leaveEnrollmentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in first");
      return;
    }

    const enrollmentId = asObjectId(req.params.enrollmentId as string);
    if (!enrollmentId) {
      fail(res, 400, "Invalid enrollment ID");
      return;
    }

    const enrollment = await CoachEnrollment.findOne({
      _id: enrollmentId,
      userId: req.user.id,
    });
    if (!enrollment) {
      fail(res, 404, "Enrollment not found");
      return;
    }

    const result = await cancelEnrollment({
      enrollmentId: enrollment._id as mongoose.Types.ObjectId,
      reason: req.body?.reason,
    });

    // The amount owed is computed exactly from the ledger — it is not a
    // judgement call — so it is issued here rather than queued for finance.
    // A failure leaves the credits frozen and retryable; it does not fail the
    // cancellation, because the student has already left either way.
    const refund = await refundUnusedCreditsForEnrollment({
      enrollmentId: enrollment._id as mongoose.Types.ObjectId,
      reason: req.body?.reason || "Left the programme",
    });

    ok(
      res,
      refund.status === "REFUNDED"
        ? "You have left this programme — your refund is on its way"
        : "You have left this programme",
      {
        enrollment: result.enrollment,
        unusedSessions: result.unusedCredits,
        refund: {
          status: refund.status,
          amountPaise: refund.amountPaise,
          ...(refund.refundId ? { refundId: refund.refundId } : {}),
        },
      },
    );
  } catch (error) {
    log.error("leaveEnrollmentHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

/**
 * Renew a programme for another billing period.
 *
 * Goes through the SAME checkout as the first payment — there is no payment
 * mandate in this integration, so renewing is the payer completing a payment,
 * not us charging them. Reconciliation then extends the subscription's period
 * and grants the next period's credits, exactly as it did the first time.
 */
export const renewEnrollmentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in first");
      return;
    }

    const enrollmentId = asObjectId(req.params.enrollmentId as string);
    if (!enrollmentId) {
      fail(res, 400, "Invalid enrollment ID");
      return;
    }

    const target = await renewalTargetForEnrollment({
      enrollmentId,
      userId: new mongoose.Types.ObjectId(req.user.id),
    });

    if (!target) {
      // Covers both "not yours" and "already released" on purpose — a fully
      // expired enrolment has lost its seat and must go through enrolment
      // again, which is a different, capacity-checked path.
      fail(
        res,
        404,
        "This programme can no longer be renewed — join it again to get a place",
      );
      return;
    }

    const checkout = await initiateSubscriptionCheckout({
      userId: req.user.id,
      coachId: target.coachId.toString(),
      packageId: target.packageId.toString(),
      offeringId: target.offeringId,
      enrollmentId,
      redirectType: "programme",
    });

    ok(res, "Complete payment to renew", {
      redirectUrl: checkout.redirectUrl,
      merchantOrderId: checkout.merchantOrderId,
      amountBreakdown: checkout.amountBreakdown,
    });
  } catch (error) {
    log.error("renewEnrollmentHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

// ───────────────── waitlist ─────────────────

export const joinWaitlistHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in to join the waiting list");
      return;
    }

    const offeringId = asObjectId(req.params.offeringId as string);
    if (!offeringId) {
      fail(res, 400, "Invalid offering ID");
      return;
    }

    const entry = await joinWaitlist({
      offeringId,
      userId: new mongoose.Types.ObjectId(req.user.id),
      playerId: req.body.playerId ? asObjectId(req.body.playerId) : null,
      studentName: req.body.studentName,
    });

    res.status(201).json({
      success: true,
      message: "You're on the waiting list — we'll tell you when a place opens",
      data: { entry },
    });
  } catch (error) {
    log.error("joinWaitlistHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const leaveWaitlistHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in first");
      return;
    }

    const entryId = asObjectId(req.params.entryId as string);
    if (!entryId) {
      fail(res, 400, "Invalid waitlist entry ID");
      return;
    }

    const left = await leaveWaitlist({
      entryId,
      userId: new mongoose.Types.ObjectId(req.user.id),
    });

    if (!left) {
      fail(res, 404, "Waiting list entry not found");
      return;
    }

    ok(res, "You have left the waiting list");
  } catch (error) {
    log.error("leaveWaitlistHandler failed:", error);
    fail(res, 400, (error as Error).message);
  }
};

export const myWaitlistHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in first");
      return;
    }

    const entries = await waitlistEntriesForUser(
      new mongoose.Types.ObjectId(req.user.id),
    );

    ok(res, "Waiting list retrieved", { entries: transformDocuments(entries) });
  } catch (error) {
    log.error("myWaitlistHandler failed:", error);
    fail(res, 500, "Failed to load your waiting list");
  }
};

/** The coach's view of who is queueing for their programme. */
export const offeringWaitlistHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const coach = await requireOwnCoach(req, res);
    if (!coach) return;
    const offering = await ownedOffering(
      res,
      coach._id as mongoose.Types.ObjectId,
      req.params.offeringId as string,
    );
    if (!offering) return;

    const entries = await waitlistForOffering(
      offering._id as mongoose.Types.ObjectId,
    );

    ok(res, "Waiting list retrieved", { entries: transformDocuments(entries) });
  } catch (error) {
    log.error("offeringWaitlistHandler failed:", error);
    fail(res, 500, "Failed to load the waiting list");
  }
};

export const myUpcomingSessionsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      fail(res, 401, "Sign in first");
      return;
    }

    const sessions = await CoachSessionOccurrence.find({
      "roster.userId": new mongoose.Types.ObjectId(req.user.id),
      status: "SCHEDULED",
      scheduledAt: { $gte: new Date() },
    })
      .sort({ scheduledAt: 1 })
      .limit(50)
      .lean();

    ok(res, "Upcoming sessions retrieved", {
      sessions: transformDocuments(sessions),
    });
  } catch (error) {
    log.error("myUpcomingSessionsHandler failed:", error);
    fail(res, 500, "Failed to load upcoming sessions");
  }
};

// ───────────────── public discovery ─────────────────

/**
 * Browse published programmes.
 *
 * Online programmes are deliberately reachable here without any location
 * filter: the coach-discovery endpoint is a `$geoNear` over coaches with a base
 * location, and an online-only coach has none, so they would be invisible there
 * forever. This is the non-geographic lane.
 */
export const browseOfferingsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const query: Record<string, unknown> = { status: "ACTIVE" };

    if (req.query.sport) query.sport = String(req.query.sport);
    if (req.query.deliveryKind) {
      query.deliveryKind = String(req.query.deliveryKind);
    }
    if (req.query.online === "true") query.deliveryKind = "ONLINE";

    const offerings = await CoachOffering.find(query)
      .populate({
        path: "coachId",
        select: "userId bio sports rating reviewCount isVerified",
        populate: { path: "userId", select: "name photoUrl" },
      })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    // `.lean()` skips the schema's toJSON transform, so these plain objects
    // carry `_id` and no `id`. Without this every client link renders as
    // /programmes/undefined.
    const withSeats = transformDocuments(offerings).map((offering: any) => ({
      ...offering,
      seatsLeft: Math.max(0, offering.capacity - offering.enrolledCount),
      isFull: offering.enrolledCount >= offering.capacity,
    }));

    ok(res, "Programmes retrieved", { offerings: withSeats });
  } catch (error) {
    log.error("browseOfferingsHandler failed:", error);
    fail(res, 500, "Failed to load programmes");
  }
};
