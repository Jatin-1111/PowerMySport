import mongoose from "mongoose";
import { CoachEnrollment } from "../models/CoachEnrollment";
import { CoachSessionCredit } from "../models/CoachSessionCredit";
import { CoachSubscriptionPaymentTransaction } from "../models/CoachSubscriptionPayment";
import {
  freezeCreditsForRefund,
  markCreditsRefunded,
  unfreezeCreditsForRefund,
} from "./CoachCreditLedgerService";
import { initiateRefund } from "./RefundService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachRefund");

/**
 * Paying back the classes a student bought and did not receive.
 *
 * The amount is not a judgement call: it is the value of their unconsumed
 * credits, which is exactly what they paid for and did not get. That is why
 * this can be issued automatically rather than sitting in a finance queue the
 * way expert-session refunds do.
 *
 * WHAT IS REFUNDED. The credits' value only — that is the coach's share, the
 * `baseAmount` of the original payment. The platform fee and its tax are NOT
 * returned, on the basis that the platform did its part for the period.
 * POLICY: this is a decision, not a law; if the business wants fees returned
 * pro-rata, `refundableAmountPaise` below is the single place that changes.
 *
 * ORDER OF OPERATIONS. Credits are frozen to REFUND_PENDING *before* the money
 * is asked for, and only marked REFUNDED once it has moved. A refund that fails
 * therefore leaves a visible, retryable claim rather than either double-paying
 * or evaporating at period end.
 */

export interface EnrollmentRefundResult {
  status: "REFUNDED" | "NOTHING_OWED" | "NO_PAYMENT_FOUND" | "FAILED";
  amountPaise: number;
  creditCount: number;
  refundId?: string;
  reason?: string;
}

/**
 * The payment this enrolment's refund should be drawn from: its most recent
 * settled one, minus anything already refunded against it.
 */
const refundableAmountPaise = async (
  enrollmentId: mongoose.Types.ObjectId,
  owedPaise: number
): Promise<{ transaction: any; amountPaise: number } | null> => {
  const transaction = await CoachSubscriptionPaymentTransaction.findOne({
    enrollmentId,
    status: "COMPLETED",
  }).sort({ createdAt: -1 });

  if (!transaction) return null;

  const alreadyRefunded = transaction.refundAmount ?? 0;
  const headroom = Math.max(0, (transaction.amount ?? 0) - alreadyRefunded);

  // Never ask the gateway for more than the payment can give back, even if the
  // ledger says more is owed — that would be rejected, and the mismatch is
  // worth surfacing rather than silently over-claiming.
  return { transaction, amountPaise: Math.min(owedPaise, headroom) };
};

/**
 * Issue the refund a student is owed for classes they never had.
 *
 * Idempotent by construction: the freeze moves credits out of AVAILABLE, so a
 * second call finds nothing owed and returns NOTHING_OWED rather than paying
 * twice.
 */
export const refundUnusedCreditsForEnrollment = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  reason?: string;
}): Promise<EnrollmentRefundResult> => {
  const { enrollmentId } = params;

  const frozen = await freezeCreditsForRefund({ enrollmentId });
  if (frozen.count === 0) {
    return { status: "NOTHING_OWED", amountPaise: 0, creditCount: 0 };
  }

  const refundable = await refundableAmountPaise(enrollmentId, frozen.amountPaise);

  if (!refundable) {
    // No settled payment to refund against — a comped or manually-created
    // enrolment. Hand the credits back so the claim stays visible instead of
    // being frozen forever with nothing chasing it.
    await unfreezeCreditsForRefund({ enrollmentId });
    log.warn(
      `refundUnusedCreditsForEnrollment: no completed payment for enrolment ${enrollmentId.toString()}`
    );
    return {
      status: "NO_PAYMENT_FOUND",
      amountPaise: frozen.amountPaise,
      creditCount: frozen.count,
    };
  }

  if (refundable.amountPaise <= 0) {
    await unfreezeCreditsForRefund({ enrollmentId });
    return {
      status: "NOTHING_OWED",
      amountPaise: 0,
      creditCount: frozen.count,
      reason: "The original payment has already been fully refunded",
    };
  }

  try {
    const result = await initiateRefund({
      bookingPaymentTransactionId: refundable.transaction._id.toString(),
      source: "COACH_SUBSCRIPTION",
      amount: refundable.amountPaise,
      ...(params.reason ? { reason: params.reason } : {}),
    });

    // INITIATED is success as far as this service is concerned: the money is
    // with the gateway and the existing refund-poll job carries it to
    // COMPLETED. Holding the credits open past this point would risk paying a
    // second time on a retry.
    await markCreditsRefunded({ enrollmentId });

    log.info(
      `refundUnusedCreditsForEnrollment: refunded ${refundable.amountPaise} paise ` +
        `across ${frozen.count} credit(s) for enrolment ${enrollmentId.toString()}`
    );

    return {
      status: "REFUNDED",
      amountPaise: refundable.amountPaise,
      creditCount: frozen.count,
      ...(result.refundId ? { refundId: result.refundId } : {}),
    };
  } catch (error) {
    // Credits stay REFUND_PENDING on purpose: the claim survives, the expiry
    // sweep cannot touch it, and `retryPendingEnrollmentRefunds` will try again.
    log.error(`refundUnusedCreditsForEnrollment failed for ${enrollmentId.toString()}:`, error);
    return {
      status: "FAILED",
      amountPaise: refundable.amountPaise,
      creditCount: frozen.count,
      reason: error instanceof Error ? error.message : "Refund failed",
    };
  }
};

/**
 * Retry refunds that were owed but could not be issued.
 *
 * Finds credits left frozen by a failed attempt and tries each enrolment again.
 * Without this a gateway outage at the moment someone cancelled would leave
 * their money permanently unclaimed.
 */
export const retryPendingEnrollmentRefunds = async (
  params: {
    limit?: number;
  } = {}
): Promise<{ attempted: number; refunded: number }> => {
  const stuck = await CoachSessionCredit.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $match: { status: "REFUND_PENDING" } },
    { $group: { _id: "$enrollmentId" } },
    { $limit: params.limit ?? 25 },
  ]);

  let refunded = 0;
  for (const row of stuck) {
    // Unfreeze first so the normal path can re-freeze and re-price: the
    // refundable headroom may have changed since the failed attempt.
    await unfreezeCreditsForRefund({ enrollmentId: row._id });
    const result = await refundUnusedCreditsForEnrollment({
      enrollmentId: row._id,
      reason: "Retry of a previously failed programme refund",
    });
    if (result.status === "REFUNDED") refunded += 1;
  }

  if (stuck.length > 0) {
    log.info(`retryPendingEnrollmentRefunds: retried ${stuck.length}, refunded ${refunded}`);
  }

  return { attempted: stuck.length, refunded };
};

/** What a student would get back if they left right now. */
export const previewEnrollmentRefund = async (
  enrollmentId: mongoose.Types.ObjectId
): Promise<{ amountPaise: number; creditCount: number }> => {
  const rows = await CoachSessionCredit.aggregate<{
    count: number;
    amountPaise: number;
  }>([
    {
      $match: {
        enrollmentId,
        status: { $in: ["AVAILABLE", "REFUND_PENDING"] },
      },
    },
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
    amountPaise: row?.amountPaise ?? 0,
    creditCount: row?.count ?? 0,
  };
};

export const enrollmentOwnedBy = async (
  enrollmentId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<boolean> => Boolean(await CoachEnrollment.exists({ _id: enrollmentId, userId }));
