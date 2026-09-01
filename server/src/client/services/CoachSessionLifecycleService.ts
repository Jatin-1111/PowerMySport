import mongoose from "mongoose";
import {
  CoachAttendanceMark,
  CoachSessionOccurrence,
  CoachSessionOccurrenceDocument,
} from "../models/CoachSessionOccurrence";
import { CoachOffering } from "../models/CoachOffering";
import { CoachSessionCredit } from "../models/CoachSessionCredit";
import {
  consumeCreditForOccurrence,
  releaseCreditsForOccurrence,
} from "./CoachCreditLedgerService";
import { resolveOfferingDelivery } from "./CoachOccurrenceService";
import { commissionOn } from "./CommissionService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachSessions");

/**
 * The lifecycle of a coaching session, and the coach's earnings from it.
 *
 * The rules the platform agreed to, and where each one lives:
 *
 *  - PAYOUT PER OCCURRENCE. Completing a session consumes one credit per seat
 *    on the roster; the sum of those credits IS the coach's earning. A coach is
 *    therefore paid for sessions delivered, never for time merely billed.
 *  - A STUDENT NO-SHOW STILL PAYS. Attendance is a record, not a funding rule:
 *    PRESENT and ABSENT both consume. The coach turned up either way.
 *  - A COACH CANCELLATION CONSUMES NOTHING. The credits simply survive, so the
 *    makeup session spends them later. That is the entire makeup mechanism —
 *    there is no makeup entitlement field and no special payout path.
 *
 * ON TRANSACTIONS. Completion is not wrapped in a multi-document transaction.
 * It does not need to be: each credit is claimed by a single atomic
 * findOneAndUpdate, a seat already funded for this occurrence short-circuits,
 * and the unique (consumedByOccurrenceId, enrollmentId) index makes a second
 * credit for the same seat impossible. That makes completion safely retryable
 * after a partial failure, which is a stronger property than atomicity here —
 * and it does not require the deployment to be a replica set.
 */

/** Hours between a session completing and its earnings becoming payable. */
export const PAYOUT_RELEASE_HOURS = 24;

const hoursMs = 60 * 60 * 1000;

export interface CompleteOccurrenceResult {
  occurrence: CoachSessionOccurrenceDocument;
  seatsFunded: number;
  seatsUnfunded: number;
  /** Gross earned by the session — the Partner Fee, before deductions. */
  amountPaise: number;
  netPayablePaise: number;
  commissionPaise: number;
  commissionGstPaise: number;
}


/**
 * The last date on which every student on this session still has a live credit.
 *
 * Returns null when nobody has one — an unfunded session imposes no deadline,
 * because there is nothing left to strand.
 */
const earliestCreditDeadline = async (
  occurrence: CoachSessionOccurrenceDocument,
): Promise<Date | null> => {
  const enrollmentIds = occurrence.roster.map((seat) => seat.enrollmentId);
  if (enrollmentIds.length === 0) return null;

  const credits = await CoachSessionCredit.find({
    enrollmentId: { $in: enrollmentIds },
    status: "AVAILABLE",
  })
    .select("periodEnd")
    .sort({ periodEnd: 1 })
    .limit(1)
    .lean();

  return credits[0]?.periodEnd ?? null;
};

/**
 * Mark one student's attendance. Allowed while the session is SCHEDULED or after
 * it has COMPLETED (a coach correcting the register), but never on a cancelled
 * session — nobody attended a session that did not happen.
 */
export const markAttendance = async (params: {
  occurrenceId: mongoose.Types.ObjectId;
  enrollmentId: mongoose.Types.ObjectId;
  mark: CoachAttendanceMark;
}): Promise<CoachSessionOccurrenceDocument> => {
  const occurrence = await CoachSessionOccurrence.findById(params.occurrenceId);
  if (!occurrence) throw new Error("Session not found");

  if (occurrence.status.startsWith("CANCELLED")) {
    throw new Error("Attendance cannot be marked on a cancelled session");
  }

  const seat = occurrence.roster.find(
    (entry) => entry.enrollmentId.toString() === params.enrollmentId.toString(),
  );
  if (!seat) throw new Error("That student is not on this session's roster");

  seat.attendance = params.mark;
  await occurrence.save();
  return occurrence;
};

/**
 * Complete a session: fund every seat from the ledger and bank the coach's
 * earning.
 *
 * Idempotent — running it twice does not pay twice, because a seat already
 * funded for this occurrence reuses its existing credit.
 */
export const completeOccurrence = async (params: {
  occurrenceId: mongoose.Types.ObjectId;
  coachNotes?: string;
  at?: Date;
}): Promise<CompleteOccurrenceResult> => {
  const at = params.at ?? new Date();
  const occurrence = await CoachSessionOccurrence.findById(params.occurrenceId);
  if (!occurrence) throw new Error("Session not found");

  if (occurrence.status.startsWith("CANCELLED")) {
    throw new Error("A cancelled session cannot be completed");
  }

  let seatsFunded = 0;
  let seatsUnfunded = 0;
  let amountPaise = 0;

  // The "was this seat already funded?" check only needs to know about
  // *this* occurrence, so one query for the whole roster replaces what was
  // previously a `findOne` per seat (up to 100). The actual credit
  // consumption below stays one call per seat — that atomic
  // findOneAndUpdate, in oldest-credit-first order, is what prevents two
  // seats from racing for the same credit, and batching it isn't safe.
  const alreadyConsumedCredits = await CoachSessionCredit.find({
    consumedByOccurrenceId: occurrence._id,
  }).exec();
  const alreadyConsumedByEnrollmentId = new Map(
    alreadyConsumedCredits.map((credit) => [
      credit.enrollmentId.toString(),
      credit,
    ]),
  );

  for (const seat of occurrence.roster) {
    const credit = await consumeCreditForOccurrence({
      enrollmentId: seat.enrollmentId,
      occurrenceId: occurrence._id as mongoose.Types.ObjectId,
      at,
      alreadyConsumed:
        alreadyConsumedByEnrollmentId.get(seat.enrollmentId.toString()) ??
        null,
    });

    if (credit) {
      seat.creditId = credit._id as mongoose.Types.ObjectId;
      seat.earnedPaise = credit.valuePaise;
      amountPaise += credit.valuePaise;
      seatsFunded += 1;
    } else {
      // The student's subscription lapsed or ran out of sessions. The session
      // still happened, so it is completed and recorded — but this seat earns
      // nothing and is surfaced rather than silently absorbed.
      seat.creditId = null;
      seat.earnedPaise = 0;
      seatsUnfunded += 1;
    }

    // A seat the coach never marked counts as attended: the session was
    // delivered to them. Only an explicit ABSENT says otherwise, and it changes
    // the record, not the money.
    if (seat.attendance === "PENDING") seat.attendance = "PRESENT";
  }

  // The credits consumed are the coach's Partner Fee; the platform's commission
  // and the GST on it come out before payout, per the Partner Terms.
  const commission = commissionOn(amountPaise);

  occurrence.status = "COMPLETED";
  occurrence.completedAt = at;
  if (params.coachNotes !== undefined) occurrence.coachNotes = params.coachNotes;
  occurrence.payout.grossPaise = commission.partnerFeePaise;
  occurrence.payout.commissionRate = commission.rate;
  occurrence.payout.commissionPaise = commission.commissionPaise;
  occurrence.payout.commissionGstPaise = commission.gstOnCommissionPaise;
  occurrence.payout.amountPaise = commission.netPayablePaise;
  occurrence.payout.status = "PENDING";
  occurrence.payout.releaseAt = new Date(
    at.getTime() + PAYOUT_RELEASE_HOURS * hoursMs,
  );

  await occurrence.save();

  if (seatsUnfunded > 0) {
    log.warn(
      `completeOccurrence: session ${occurrence._id.toString()} had ` +
        `${seatsUnfunded} unfunded seat(s) — a student's credits have run out`,
    );
  }

  return {
    occurrence,
    seatsFunded,
    seatsUnfunded,
    // The gross the session earned. The coach's net is on `occurrence.payout`.
    amountPaise,
    netPayablePaise: commission.netPayablePaise,
    commissionPaise: commission.commissionPaise,
    commissionGstPaise: commission.gstOnCommissionPaise,
  };
};

/**
 * Undo a completion — an admin correcting a session marked complete by mistake.
 *
 * Returns the credits so the students are not silently charged for a session
 * that is now agreed not to have happened, and clears the payout.
 */
export const reopenOccurrence = async (params: {
  occurrenceId: mongoose.Types.ObjectId;
}): Promise<CoachSessionOccurrenceDocument> => {
  const occurrence = await CoachSessionOccurrence.findById(params.occurrenceId);
  if (!occurrence) throw new Error("Session not found");

  if (occurrence.payout.status === "PAID") {
    throw new Error(
      "This session has already been paid out and cannot be reopened. " +
        "Reverse the payout first.",
    );
  }

  await releaseCreditsForOccurrence({
    occurrenceId: occurrence._id as mongoose.Types.ObjectId,
  });

  occurrence.status = "SCHEDULED";
  occurrence.completedAt = null;
  occurrence.payout = {
    status: "PENDING",
    amountPaise: 0,
    grossPaise: 0,
    commissionPaise: 0,
    commissionGstPaise: 0,
    commissionRate: 0,
    releaseAt: null,
    paidAt: null,
  };
  occurrence.roster = occurrence.roster.map((seat) => ({
    ...(seat as any),
    creditId: null,
    earnedPaise: 0,
  })) as typeof occurrence.roster;

  await occurrence.save();
  return occurrence;
};

/**
 * The coach calls off a session.
 *
 * Consumes nothing. The students' credits stay AVAILABLE, which is precisely
 * what funds the makeup — no entitlement is written down anywhere because the
 * unspent credit already is the entitlement.
 */
export const cancelOccurrenceByCoach = async (params: {
  occurrenceId: mongoose.Types.ObjectId;
  reason?: string;
  at?: Date;
  byPlatform?: boolean;
}): Promise<CoachSessionOccurrenceDocument> => {
  const at = params.at ?? new Date();
  const occurrence = await CoachSessionOccurrence.findById(params.occurrenceId);
  if (!occurrence) throw new Error("Session not found");

  if (occurrence.status === "COMPLETED") {
    throw new Error(
      "A completed session cannot be cancelled. Reopen it first if it was " +
        "marked complete in error.",
    );
  }

  occurrence.status = params.byPlatform
    ? "CANCELLED_BY_PLATFORM"
    : "CANCELLED_BY_COACH";
  occurrence.cancelledAt = at;
  if (params.reason) occurrence.cancelReason = params.reason;
  occurrence.payout = {
    status: "PENDING",
    amountPaise: 0,
    grossPaise: 0,
    commissionPaise: 0,
    commissionGstPaise: 0,
    commissionRate: 0,
    releaseAt: null,
    paidAt: null,
  };

  await occurrence.save();
  return occurrence;
};

/**
 * Schedule a replacement for a session the coach called off.
 *
 * The makeup is an ordinary occurrence carrying the same roster; it consumes
 * the credits the cancellation left unspent when it completes. It is flagged
 * `isMakeup` so it sits outside the generator's uniqueness rule and is never
 * treated as a pattern session.
 */
export const scheduleMakeup = async (params: {
  cancelledOccurrenceId: mongoose.Types.ObjectId;
  scheduledAt: Date;
  durationMinutes?: number;
}): Promise<CoachSessionOccurrenceDocument> => {
  const cancelled = await CoachSessionOccurrence.findById(
    params.cancelledOccurrenceId,
  );
  if (!cancelled) throw new Error("Session not found");

  if (cancelled.status !== "CANCELLED_BY_COACH" && cancelled.status !== "CANCELLED_BY_PLATFORM") {
    throw new Error(
      "A makeup can only replace a session the coach or platform cancelled. " +
        "A student who missed a session is not owed one.",
    );
  }

  if (cancelled.makeupOccurrenceId) {
    throw new Error("This session already has a makeup scheduled");
  }

  // POLICY: a makeup must run inside the billing period that paid for it.
  //
  // That is not an arbitrary deadline — it is the only one that needs no extra
  // machinery. The credits funding this session expire with their period, so a
  // makeup scheduled past that date would arrive to find its seats unfunded and
  // the coach would deliver a class nobody could pay them for.
  //
  // The binding date is the EARLIEST period end on the roster: in a batch with
  // staggered joins, a later date would strand whoever renews soonest.
  const fundingDeadline = await earliestCreditDeadline(cancelled);
  if (fundingDeadline && params.scheduledAt > fundingDeadline) {
    throw new Error(
      `A makeup must run by ${fundingDeadline.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      })}, while the classes it replaces are still paid for.`,
    );
  }

  const offering = await CoachOffering.findById(cancelled.offeringId);
  if (!offering) throw new Error("Offering not found");

  const delivery = await resolveOfferingDelivery(offering);

  const makeup = await CoachSessionOccurrence.create({
    offeringId: cancelled.offeringId,
    coachId: cancelled.coachId,
    sport: cancelled.sport,
    scheduledAt: params.scheduledAt,
    durationMinutes: params.durationMinutes ?? cancelled.durationMinutes,
    status: "SCHEDULED",
    ...(delivery ? { delivery } : {}),
    // Same students as the session being replaced, with attendance reset.
    roster: cancelled.roster.map((seat) => ({
      enrollmentId: seat.enrollmentId,
      userId: seat.userId,
      playerId: seat.playerId ?? null,
      studentName: seat.studentName,
      attendance: "PENDING" as const,
    })),
    isMakeup: true,
    replacesOccurrenceId: cancelled._id,
    payout: { status: "PENDING", amountPaise: 0 },
  });

  cancelled.makeupOccurrenceId = makeup._id as mongoose.Types.ObjectId;
  await cancelled.save();

  return makeup;
};

/** Cancelled sessions still owing a makeup. Drives the coach's to-do list. */
export const outstandingMakeups = async (params: {
  coachId?: mongoose.Types.ObjectId;
  offeringId?: mongoose.Types.ObjectId;
}): Promise<CoachSessionOccurrenceDocument[]> => {
  const query: Record<string, unknown> = {
    status: { $in: ["CANCELLED_BY_COACH", "CANCELLED_BY_PLATFORM"] },
    makeupOccurrenceId: null,
  };
  if (params.coachId) query.coachId = params.coachId;
  if (params.offeringId) query.offeringId = params.offeringId;

  return CoachSessionOccurrence.find(query).sort({ scheduledAt: 1 }).exec();
};

// ───────────────── payouts ─────────────────

/**
 * Move due earnings from PENDING to RELEASED.
 *
 * This is the first payout pipeline the coach domain has had — coach "earnings"
 * were previously an analytics sum over completed bookings, which is a report,
 * not a ledger. Zero-value sessions are released too, so the pipeline does not
 * accumulate a tail of stuck rows.
 */
export const releaseDuePayouts = async (params: { asOf?: Date } = {}): Promise<number> => {
  const asOf = params.asOf ?? new Date();

  const result = await CoachSessionOccurrence.updateMany(
    {
      status: "COMPLETED",
      "payout.status": "PENDING",
      "payout.releaseAt": { $lte: asOf },
    },
    { $set: { "payout.status": "RELEASED" } },
  ).exec();

  const count = result.modifiedCount ?? 0;
  if (count > 0) log.info(`releaseDuePayouts: released ${count} session payout(s)`);
  return count;
};

/** Record that a released payout has actually been paid. */
export const markPayoutPaid = async (params: {
  occurrenceId: mongoose.Types.ObjectId;
  at?: Date;
}): Promise<CoachSessionOccurrenceDocument> => {
  const occurrence = await CoachSessionOccurrence.findById(params.occurrenceId);
  if (!occurrence) throw new Error("Session not found");

  if (occurrence.payout.status !== "RELEASED") {
    throw new Error(
      `Only a released payout can be marked paid (this one is ${occurrence.payout.status})`,
    );
  }

  occurrence.payout.status = "PAID";
  occurrence.payout.paidAt = params.at ?? new Date();
  await occurrence.save();
  return occurrence;
};

/** What a coach is owed, bucketed by payout state. */
export const coachEarningsSummary = async (
  coachId: mongoose.Types.ObjectId,
): Promise<
  Record<
    string,
    {
      sessions: number;
      amountPaise: number;
      grossPaise: number;
      commissionPaise: number;
      commissionGstPaise: number;
    }
  >
> => {
  const rows = await CoachSessionOccurrence.aggregate<{
    _id: string;
    sessions: number;
    amountPaise: number;
    grossPaise: number;
    commissionPaise: number;
    commissionGstPaise: number;
  }>([
    { $match: { coachId, status: "COMPLETED" } },
    {
      $group: {
        _id: "$payout.status",
        sessions: { $sum: 1 },
        // Net is what the coach receives; gross and the deductions are carried
        // alongside so a smaller number is never shown without its reason.
        amountPaise: { $sum: "$payout.amountPaise" },
        grossPaise: { $sum: "$payout.grossPaise" },
        commissionPaise: { $sum: "$payout.commissionPaise" },
        commissionGstPaise: { $sum: "$payout.commissionGstPaise" },
      },
    },
  ]);

  return Object.fromEntries(
    rows.map((row) => [
      row._id,
      {
        sessions: row.sessions,
        amountPaise: row.amountPaise,
        grossPaise: row.grossPaise ?? 0,
        commissionPaise: row.commissionPaise ?? 0,
        commissionGstPaise: row.commissionGstPaise ?? 0,
      },
    ]),
  );
};

/**
 * How reliably a coach turns up, over a recent window.
 *
 * POLICY: cancellations are counted and shown, not capped. A hard limit
 * punishes a coach who is genuinely ill exactly as hard as one who is
 * unreliable, and the platform cannot tell those apart from the outside. The
 * number is put in front of the coach and available to ops; acting on it is a
 * human decision.
 */
export const coachReliabilitySummary = async (params: {
  coachId: mongoose.Types.ObjectId;
  sinceDays?: number;
  now?: Date;
}): Promise<{
  windowDays: number;
  delivered: number;
  cancelledByCoach: number;
  cancellationRate: number;
  makeupsOwed: number;
}> => {
  const now = params.now ?? new Date();
  const windowDays = params.sinceDays ?? 90;
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const [delivered, cancelledByCoach, makeupsOwed] = await Promise.all([
    CoachSessionOccurrence.countDocuments({
      coachId: params.coachId,
      status: "COMPLETED",
      scheduledAt: { $gte: since },
    }),
    CoachSessionOccurrence.countDocuments({
      coachId: params.coachId,
      status: "CANCELLED_BY_COACH",
      scheduledAt: { $gte: since },
    }),
    CoachSessionOccurrence.countDocuments({
      coachId: params.coachId,
      status: { $in: ["CANCELLED_BY_COACH", "CANCELLED_BY_PLATFORM"] },
      makeupOccurrenceId: null,
    }),
  ]);

  const total = delivered + cancelledByCoach;

  return {
    windowDays,
    delivered,
    cancelledByCoach,
    // Rounded to whole percent — this is a signal for a human, not a threshold.
    cancellationRate: total === 0 ? 0 : Math.round((cancelledByCoach / total) * 100),
    makeupsOwed,
  };
};
