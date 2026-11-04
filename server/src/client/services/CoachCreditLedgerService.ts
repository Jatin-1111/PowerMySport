import mongoose from "mongoose";
import { CoachSessionCredit, CoachSessionCreditDocument } from "../models/CoachSessionCredit";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachCredits");

/**
 * The session-credit ledger: grant per billing period, consume per delivered
 * session. See the block comment on the CoachSessionCredit model for why payout,
 * makeups and refunds are all consequences of this one mechanism.
 */

/**
 * Split a period fee into `count` credit values that sum to it EXACTLY.
 *
 * Naive division loses the remainder — at 4000 paise over 3 sessions, three
 * credits of 1333 sum to 3999 and the missing paisa compounds every period, per
 * student, forever. The remainder is instead handed out one paisa at a time to
 * the earliest credits.
 */
export const allocateCreditValues = (totalPaise: number, count: number): number[] => {
  if (!Number.isFinite(totalPaise) || totalPaise < 0) {
    throw new Error("Credit allocation needs a non-negative total in paise");
  }
  if (!Number.isInteger(totalPaise)) {
    throw new Error("Credit allocation needs whole paise, not fractions");
  }
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Credit allocation needs a whole, non-negative count");
  }
  if (count === 0) return [];

  const base = Math.floor(totalPaise / count);
  const residue = totalPaise - base * count;

  return Array.from({ length: count }, (_unused, index) => (index < residue ? base + 1 : base));
};

export interface GrantCreditsPayload {
  enrollmentId: mongoose.Types.ObjectId;
  offeringId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId | null;
  subscriptionId?: mongoose.Types.ObjectId | null;
  periodStart: Date;
  periodEnd: Date;
  /** How many sessions this period buys. */
  sessionCount: number;
  /** What the student was charged for the period, in paise. */
  feePaise: number;
  session?: mongoose.ClientSession;
}

/**
 * Grant a period's credits. Idempotent per (enrollment, period): re-running a
 * billing hook must not double-grant, so an existing grant for the same period
 * short-circuits.
 */
export const grantCreditsForPeriod = async (
  payload: GrantCreditsPayload
): Promise<CoachSessionCreditDocument[]> => {
  const { enrollmentId, periodStart, periodEnd, sessionCount, feePaise, session } = payload;

  if (sessionCount <= 0) return [];

  const existing = await CoachSessionCredit.find({
    enrollmentId,
    periodStart,
    periodEnd,
  })
    .session(session ?? null)
    .exec();

  if (existing.length > 0) {
    log.info(
      `grantCreditsForPeriod: enrollment ${enrollmentId.toString()} already has ` +
        `${existing.length} credit(s) for this period — not re-granting`
    );
    return existing;
  }

  const values = allocateCreditValues(feePaise, sessionCount);

  const docs = values.map((valuePaise) => ({
    enrollmentId,
    offeringId: payload.offeringId,
    coachId: payload.coachId,
    userId: payload.userId,
    playerId: payload.playerId ?? null,
    subscriptionId: payload.subscriptionId ?? null,
    periodStart,
    periodEnd,
    valuePaise,
    status: "AVAILABLE" as const,
  }));

  return CoachSessionCredit.create(docs, session ? { session } : {});
};

/**
 * Spend one credit for a student's seat at a session.
 *
 * The read and the write are a single atomic findOneAndUpdate on purpose: two
 * concurrent completions of the same occurrence (a retried request, a coach
 * double-tapping) must not be able to spend the same credit twice, and must not
 * be able to spend two credits for one seat either — the latter is caught by the
 * unique (consumedByOccurrenceId, enrollmentId) index.
 *
 * Returns null when the student has no credit left; the caller decides whether
 * that blocks the session or is recorded as an unfunded seat.
 */
export const consumeCreditForOccurrence = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  occurrenceId: mongoose.Types.ObjectId;
  at?: Date;
  session?: mongoose.ClientSession;
  /**
   * Pass this when the caller already knows whether this seat was
   * previously funded for this occurrence — e.g. completeOccurrence
   * batches the "already consumed" check for its whole roster in one query
   * up front instead of paying for it per seat. `undefined` (the default)
   * falls back to checking here, same as before. The funding step below —
   * the actual atomic credit consumption — is untouched either way: it
   * stays one call per seat, in oldest-credit-first order, because that
   * ordering guarantee is what this function exists to protect.
   */
  alreadyConsumed?: CoachSessionCreditDocument | null;
}): Promise<CoachSessionCreditDocument | null> => {
  const { enrollmentId, occurrenceId, session } = params;
  const at = params.at ?? new Date();

  // If this seat was already funded for this occurrence, return that credit
  // rather than spending another. Makes completion safely retryable.
  const alreadyConsumed =
    params.alreadyConsumed !== undefined
      ? params.alreadyConsumed
      : await CoachSessionCredit.findOne({
          enrollmentId,
          consumedByOccurrenceId: occurrenceId,
        })
          .session(session ?? null)
          .exec();

  if (alreadyConsumed) return alreadyConsumed;

  return CoachSessionCredit.findOneAndUpdate(
    { enrollmentId, status: "AVAILABLE" },
    {
      $set: {
        status: "CONSUMED",
        consumedByOccurrenceId: occurrenceId,
        consumedAt: at,
      },
    },
    {
      // Oldest period first, so a student never loses an expiring credit while
      // a later one is spent.
      sort: { periodEnd: 1, createdAt: 1 },
      new: true,
      session: session ?? null,
    }
  ).exec();
};

/**
 * Return credits spent on an occurrence to AVAILABLE.
 *
 * Used when a completion is reversed — an admin correcting a mis-marked
 * session. Without this the student would silently lose a paid-for session.
 */
export const releaseCreditsForOccurrence = async (params: {
  occurrenceId: mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}): Promise<number> => {
  const result = await CoachSessionCredit.updateMany(
    { consumedByOccurrenceId: params.occurrenceId, status: "CONSUMED" },
    {
      $set: { status: "AVAILABLE" },
      $unset: { consumedByOccurrenceId: "", consumedAt: "" },
    },
    params.session ? { session: params.session } : {}
  ).exec();

  return result.modifiedCount ?? 0;
};

/**
 * What a student is owed if they cancel now: the value of everything they paid
 * for and did not receive. Computed from the ledger, never estimated from
 * elapsed time.
 */
export const refundBasisPaiseForEnrollment = async (
  enrollmentId: mongoose.Types.ObjectId
): Promise<{ creditCount: number; amountPaise: number }> => {
  const rows = await CoachSessionCredit.aggregate<{
    _id: null;
    count: number;
    amountPaise: number;
  }>([
    { $match: { enrollmentId, status: "AVAILABLE" } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amountPaise: { $sum: "$valuePaise" },
      },
    },
  ]);

  const row = rows[0];
  return {
    creditCount: row?.count ?? 0,
    amountPaise: row?.amountPaise ?? 0,
  };
};

/**
 * Freeze an enrollment's unused credits while a refund is being issued.
 *
 * The freeze is what stops the period-end expiry sweep from swallowing a claim
 * whose refund failed on the first attempt — expiry only touches AVAILABLE.
 */
export const freezeCreditsForRefund = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  session?: mongoose.ClientSession;
}): Promise<{ count: number; amountPaise: number }> => {
  const pending = await CoachSessionCredit.find({
    enrollmentId: params.enrollmentId,
    status: "AVAILABLE",
  })
    .session(params.session ?? null)
    .exec();

  if (pending.length === 0) return { count: 0, amountPaise: 0 };

  await CoachSessionCredit.updateMany(
    { enrollmentId: params.enrollmentId, status: "AVAILABLE" },
    { $set: { status: "REFUND_PENDING" } },
    params.session ? { session: params.session } : {}
  ).exec();

  return {
    count: pending.length,
    amountPaise: pending.reduce((sum, c) => sum + c.valuePaise, 0),
  };
};

/** Hand frozen credits back if a refund could not be started at all. */
export const unfreezeCreditsForRefund = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
}): Promise<number> => {
  const result = await CoachSessionCredit.updateMany(
    { enrollmentId: params.enrollmentId, status: "REFUND_PENDING" },
    { $set: { status: "AVAILABLE" } }
  ).exec();

  return result.modifiedCount ?? 0;
};

/** Mark an enrollment's frozen credits refunded, once money has moved. */
export const markCreditsRefunded = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  at?: Date;
  session?: mongoose.ClientSession;
}): Promise<number> => {
  const result = await CoachSessionCredit.updateMany(
    {
      enrollmentId: params.enrollmentId,
      status: { $in: ["AVAILABLE", "REFUND_PENDING"] },
    },
    { $set: { status: "REFUNDED", refundedAt: params.at ?? new Date() } },
    params.session ? { session: params.session } : {}
  ).exec();

  return result.modifiedCount ?? 0;
};

/**
 * Lapse credits whose period has ended.
 *
 * POLICY (open question 1 in the spec): credits lapse at period end rather than
 * rolling over. Rolling them over makes the refund basis unbounded — a student
 * could accumulate a year of credits and claim the lot on cancellation. If the
 * business wants roll-over, this is the single place that changes.
 */
export const expireCreditsPastPeriod = async (
  params: {
    asOf?: Date;
    session?: mongoose.ClientSession;
  } = {}
): Promise<number> => {
  const asOf = params.asOf ?? new Date();

  const result = await CoachSessionCredit.updateMany(
    { status: "AVAILABLE", periodEnd: { $lt: asOf } },
    { $set: { status: "EXPIRED", expiredAt: asOf } },
    params.session ? { session: params.session } : {}
  ).exec();

  if ((result.modifiedCount ?? 0) > 0) {
    log.info(`expireCreditsPastPeriod: lapsed ${result.modifiedCount} credit(s)`);
  }

  return result.modifiedCount ?? 0;
};

/** Ledger summary for a student's enrollment, for the dashboard. */
export const creditSummaryForEnrollment = async (
  enrollmentId: mongoose.Types.ObjectId
): Promise<Record<string, { count: number; amountPaise: number }>> => {
  const rows = await CoachSessionCredit.aggregate<{
    _id: string;
    count: number;
    amountPaise: number;
  }>([
    { $match: { enrollmentId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        amountPaise: { $sum: "$valuePaise" },
      },
    },
  ]);

  return Object.fromEntries(
    rows.map((row) => [row._id, { count: row.count, amountPaise: row.amountPaise }])
  );
};
