import mongoose from "mongoose";
import { CoachEnrollment } from "../models/CoachEnrollment";
import { CoachOffering } from "../models/CoachOffering";
import { CoachSubscription } from "../models/CoachSubscription";
import { NotificationType } from "../models/Notification";
import { NotificationService } from "./NotificationService";
import { syncRostersForFutureOccurrences } from "./CoachOccurrenceService";
import { notifyWaitlistOfFreeSeat } from "./CoachWaitlistService";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("coachRenewal");

/**
 * Keeping a recurring programme running past its first billing period.
 *
 * WHAT THIS IS NOT: auto-debit. This integration has no payment mandate —
 * `PhonePeService` exposes one-off payments, order status, callbacks and
 * refunds, and nothing else. Charging a card again without the payer present is
 * simply not available, so "auto-renew" here means *we hold their place, tell
 * them it is due, and let them pay in one tap*. Pretending otherwise would mean
 * a parent believing their child's classes continue when nothing will charge.
 *
 * The sequence:
 *   1. a few days before the period ends -> remind the payer (once)
 *   2. at period end -> subscription goes PAST_DUE with a grace window
 *      (`lapseRenewableSubscriptionsToPastDue`), and unused credits lapse, so
 *      the student simply has no classes left
 *   3. payer renews -> the normal checkout path extends the period and grants
 *      the next period's credits
 *   4. grace runs out -> subscription EXPIRED, and the enrolment is released
 *      here so the seat goes back to the batch
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far ahead of the billing date the payer is nudged. */
export const RENEWAL_REMINDER_DAYS = 3;

const notify = (
  userId: mongoose.Types.ObjectId | string,
  type: NotificationType,
  title: string,
  message: string,
  data: Record<string, unknown> = {},
  email = false,
) => {
  NotificationService.send(
    { userId: userId.toString(), type, title, message, data },
    { sendEmail: email },
  ).catch((err: unknown) =>
    log.error("[coachRenewal] notification failed:", err),
  );
};

const formatDate = (at: Date): string =>
  new Date(at).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });

/**
 * Nudge payers whose programme renews soon, and those already in grace.
 *
 * Deduped by `renewalReminderSentAt`, which every successful renewal clears, so
 * each period nudges at most once. The claim is a conditional update rather
 * than a read-then-write so two overlapping sweeps cannot both send it.
 */
export const sendRenewalReminders = async (params: {
  now?: Date;
  daysAhead?: number;
} = {}): Promise<number> => {
  const now = params.now ?? new Date();
  const horizon = new Date(
    now.getTime() + (params.daysAhead ?? RENEWAL_REMINDER_DAYS) * DAY_MS,
  );

  const due = await CoachSubscription.find({
    status: { $in: ["ACTIVE", "PAST_DUE"] },
    autoRenew: true,
    currentPeriodEnd: { $lte: horizon },
    renewalReminderSentAt: null,
  }).select("_id userId coachId currentPeriodEnd status");

  let sent = 0;
  for (const subscription of due) {
    // Only nudge about programmes — a bare package subscription has its own
    // lifecycle and no enrolment to renew.
    const enrollment = await CoachEnrollment.findOne({
      subscriptionId: subscription._id,
      status: { $in: ["ACTIVE", "PAUSED"] },
    })
      .select("_id offeringId studentName")
      .lean();
    if (!enrollment) continue;

    const claimed = await CoachSubscription.findOneAndUpdate(
      { _id: subscription._id, renewalReminderSentAt: null },
      { $set: { renewalReminderSentAt: now } },
    );
    if (!claimed) continue;
    sent += 1;

    const offering: any = await CoachOffering.findById(enrollment.offeringId)
      .select("title")
      .lean();
    const programme = offering?.title ?? "your coaching programme";
    const isOverdue = subscription.status === "PAST_DUE";

    notify(
      subscription.userId,
      "PAYMENT_FAILED",
      isOverdue ? "Your classes have paused" : "Your classes renew soon",
      isOverdue
        ? `${enrollment.studentName}'s classes for ${programme} have run out. Renew to keep their place.`
        : `${enrollment.studentName}'s classes for ${programme} renew on ${formatDate(subscription.currentPeriodEnd)}.`,
      {
        enrollmentId: enrollment._id.toString(),
        offeringId: enrollment.offeringId.toString(),
      },
      true,
    );
  }

  if (sent > 0) log.info(`sendRenewalReminders: nudged ${sent} payer(s)`);
  return sent;
};

/**
 * Release enrolments whose subscription has fully expired.
 *
 * Deliberately NOT done when the subscription goes PAST_DUE: during grace the
 * student keeps their seat, because the whole point of grace is that a late
 * payment should not cost them their place in a full batch. Only once grace has
 * run out does the seat go back.
 */
export const releaseEnrollmentsForExpiredSubscriptions = async (params: {
  now?: Date;
} = {}): Promise<number> => {
  const now = params.now ?? new Date();

  const expired = await CoachSubscription.find({
    status: { $in: ["EXPIRED", "CANCELLED"] },
  }).select("_id");

  if (expired.length === 0) return 0;

  const stale = await CoachEnrollment.find({
    subscriptionId: { $in: expired.map((s) => s._id) },
    status: { $in: ["ACTIVE", "PAUSED", "PENDING"] },
  }).select("_id offeringId");

  let released = 0;
  const touchedOfferings = new Set<string>();

  for (const enrollment of stale) {
    // Conditional, so a renewal landing at this instant wins the race rather
    // than having the seat pulled out from under it.
    const claimed = await CoachEnrollment.findOneAndUpdate(
      {
        _id: enrollment._id,
        status: { $in: ["ACTIVE", "PAUSED", "PENDING"] },
      },
      {
        $set: {
          status: "CANCELLED",
          leftAt: now,
          cancellationReason: "Subscription ended",
        },
      },
    );
    if (!claimed) continue;

    await CoachOffering.findByIdAndUpdate(enrollment.offeringId, {
      $inc: { enrolledCount: -1 },
    });
    touchedOfferings.add(enrollment.offeringId.toString());
    released += 1;
  }

  // Take them off sessions that have not happened yet. Completed sessions keep
  // their roster — that is the record of who was actually there.
  for (const offeringId of touchedOfferings) {
    await syncRostersForFutureOccurrences({
      offeringId: new mongoose.Types.ObjectId(offeringId),
      now,
    });
    // These seats are genuinely free now, not just held.
    await notifyWaitlistOfFreeSeat({
      offeringId: new mongoose.Types.ObjectId(offeringId),
      now,
    });
  }

  if (released > 0) {
    log.info(
      `releaseEnrollmentsForExpiredSubscriptions: released ${released} seat(s)`,
    );
  }
  return released;
};

/**
 * What a payer needs to renew: the enrolment, its programme, and the package to
 * charge. Returns null when the enrolment cannot be renewed as-is — a fully
 * expired one has lost its seat and must go through normal enrolment again.
 */
export const renewalTargetForEnrollment = async (params: {
  enrollmentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
}): Promise<{
  offeringId: mongoose.Types.ObjectId;
  coachId: mongoose.Types.ObjectId;
  packageId: mongoose.Types.ObjectId;
} | null> => {
  const enrollment = await CoachEnrollment.findOne({
    _id: params.enrollmentId,
    userId: params.userId,
    status: { $in: ["ACTIVE", "PAUSED"] },
  });
  if (!enrollment) return null;

  const offering = await CoachOffering.findById(enrollment.offeringId).select(
    "_id coachId packageId status",
  );
  if (!offering || offering.status === "ARCHIVED") return null;

  return {
    offeringId: offering._id as mongoose.Types.ObjectId,
    coachId: offering.coachId,
    packageId: offering.packageId,
  };
};
