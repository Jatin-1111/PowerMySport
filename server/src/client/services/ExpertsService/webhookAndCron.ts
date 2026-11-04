import { Expert } from "../../models/ExpertProfile";
import { ExpertSession, ExpertSessionDocument } from "../../models/ExpertBooking";
import { getPhonePeOrderStatus } from "../../../shared/services/PhonePeService";
import { recordExpertSessionEvent } from "../BookingEventService";
import { log, toPaise, notify, expertUserIdOf, asRec, pickString } from "./shared";
import { applyExpertPaymentSuccess } from "./sessionLifecycle";

/**
 * Reconcile an expert session payment from a PhonePe webhook payload.
 * Only handles merchant order IDs prefixed "EXP_"; returns null otherwise so
 * the shared webhook dispatcher can try other handlers.
 */
export const reconcileExpertSessionPaymentFromWebhookPayload = async (
  rawPayload: unknown
): Promise<ExpertSessionDocument | null> => {
  const payload = asRec(rawPayload);
  const inner = asRec(payload.payload);
  const data = asRec(payload.data);

  const merchantOrderId = pickString(
    payload.originalMerchantOrderId,
    payload.merchantOrderId,
    inner.originalMerchantOrderId,
    inner.merchantOrderId,
    data.originalMerchantOrderId,
    data.merchantOrderId,
    asRec(inner.paymentDetails).merchantOrderId,
    asRec(data.paymentDetails).merchantOrderId
  );
  if (!merchantOrderId || !merchantOrderId.startsWith("EXP_")) return null;

  const session = await ExpertSession.findOne({ merchantOrderId });
  if (!session) return null;

  const rawState = pickString(
    payload.state,
    inner.state,
    data.state,
    asRec(inner.paymentDetails).state,
    asRec(data.paymentDetails).state
  );
  const upper = (rawState || "").toUpperCase();

  session.callbackPayload = payload;
  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(upper)) {
    await session.save();
    await applyExpertPaymentSuccess(session, { channel: "WEBHOOK" });
    log.info(`[ExpertWebhook] payment confirmed for session ${session._id}`);
  } else if (
    ["FAILED", "PAYMENT_ERROR", "PAYMENT_DECLINED"].includes(upper) &&
    session.paymentStatus !== "COMPLETED"
  ) {
    session.paymentStatus = "FAILED";
    if (session.status === "PENDING_PAYMENT") {
      session.status = "CANCELLED";
      session.cancelledBy = "SYSTEM";
      session.cancelReason = "Payment failed";
      session.cancelledAt = new Date();
      session.set("holdExpiresAt", undefined);
    }
    await session.save();
    log.info(`[ExpertWebhook] payment failed for session ${session._id}`);
  } else {
    await session.save();
  }
  return session;
};

// ── Background maintenance (called by scheduledJobs) ──────────────────────────

/** Expire unpaid holds so their slot frees up. */
export const expireUnpaidExpertHolds = async (): Promise<number> => {
  const now = new Date();
  const stale = await ExpertSession.find({
    status: "PENDING_PAYMENT",
    holdExpiresAt: { $lte: now },
  });
  let count = 0;
  for (const session of stale) {
    // The client-side reconcile call (and previously the webhook, see
    // phonepeWebhook.ts history) can miss a captured payment — never write
    // a hold off as expired without confirming with PhonePe first, so a
    // captured-but-unconfirmed payment doesn't get silently cancelled.
    try {
      const status = await getPhonePeOrderStatus(session.merchantOrderId);
      const state = (status.state || "").toUpperCase();
      if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(state)) {
        await applyExpertPaymentSuccess(session, { channel: "CRON" });
        continue;
      }
    } catch (err) {
      log.error(
        `[expireUnpaidExpertHolds] failed to check PhonePe status for session ${session._id}, skipping this run`,
        err
      );
      continue;
    }

    const updated = await ExpertSession.findOneAndUpdate(
      { _id: session._id, status: "PENDING_PAYMENT" },
      {
        $set: {
          status: "CANCELLED",
          cancelledBy: "SYSTEM",
          cancelledAt: now,
          cancelReason: "Payment not completed in time",
        },
      }
    );
    if (updated) {
      count += 1;
      await recordExpertSessionEvent(session, {
        type: "EXPIRED",
        fromStatus: "PENDING_PAYMENT",
        toStatus: "CANCELLED",
        actorType: "SYSTEM",
        channel: "CRON",
        occurredAt: session.holdExpiresAt ?? now,
        amountPaise: toPaise(session.amount),
        summary:
          "Unpaid hold expired — cancelled after confirming with PhonePe that no payment was captured",
        metadata: {
          merchantOrderId: session.merchantOrderId,
          holdExpiresAt: session.holdExpiresAt?.toISOString(),
        },
      });
    }
  }
  return count;
};

/** Auto-complete scheduled sessions whose end time has passed. */
// Grace period after a session's end time before the expert gets nudged —
// generous since the cleanup job itself only polls every 15–60 minutes.
const MOM_REMINDER_GRACE_MS = 2 * 60 * 60_000;

// Re-nudge cadence once a session is overdue for MOM (not one-shot — a
// session can sit SCHEDULED indefinitely now that nothing auto-completes it).
const MOM_REMINDER_REPEAT_MS = 24 * 60 * 60_000;

/**
 * Nudge experts whose SCHEDULED session has ended but still has no MOM, so
 * it never gets marked COMPLETED. Repeats every MOM_REMINDER_REPEAT_MS until
 * the expert submits notes — there is no time-based auto-complete anymore.
 */
export const sendExpertMomReminders = async (): Promise<number> => {
  const now = new Date();
  const candidates = await ExpertSession.find({
    status: "SCHEDULED",
    scheduledAt: { $exists: true },
  }).select("_id expertId scheduledAt durationMinutes momReminderSentAt");
  let count = 0;
  for (const s of candidates) {
    const end = new Date(
      new Date(s.scheduledAt as Date).getTime() + (s.durationMinutes || 60) * 60_000
    );
    if (now.getTime() - end.getTime() < MOM_REMINDER_GRACE_MS) continue;
    const lastSent = s.momReminderSentAt ? new Date(s.momReminderSentAt).getTime() : 0;
    if (now.getTime() - lastSent < MOM_REMINDER_REPEAT_MS) continue;

    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, status: "SCHEDULED", momReminderSentAt: s.momReminderSentAt },
      { $set: { momReminderSentAt: now } }
    );
    if (!updated) continue;
    count += 1;
    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "SESSION_MOM_REMINDER",
        "Add your session notes to complete this session",
        "A session of yours has ended but isn't marked complete yet — add your minutes of meeting to close it out. The parent is waiting to see your notes.",
        { sessionId: s._id.toString() },
        true
      );
    }
  }
  return count;
};

/**
 * Nudge the expert to add a meeting link when an ONLINE session is starting
 * soon and still has none. Fires once per session (deduped via
 * meetingLinkNudgeSentAt). Window is generous (up to 3h out) since the
 * cleanup job itself only polls every 15–60 minutes.
 */
export const sendExpertMeetingLinkNudges = async (): Promise<number> => {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 60 * 60_000);
  const candidates = await ExpertSession.find({
    status: "SCHEDULED",
    mode: "ONLINE",
    meetingLink: { $in: [null, ""] },
    scheduledAt: { $gte: now, $lte: soon },
    meetingLinkNudgeSentAt: { $exists: false },
  }).select("_id expertId scheduledAt");
  let count = 0;
  for (const s of candidates) {
    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, meetingLinkNudgeSentAt: { $exists: false } },
      { $set: { meetingLinkNudgeSentAt: now } }
    );
    if (!updated) continue;
    count += 1;
    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "SESSION_LINK_REQUIRED",
        "Add your meeting link",
        `Your session on ${new Date(s.scheduledAt as Date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} is coming up and still needs a meeting link.`,
        { sessionId: s._id.toString() },
        true
      );
    }
  }
  return count;
};

/**
 * "Your session starts soon" reminder to both parties, with whatever
 * connection details are available (meeting link for ONLINE, address for
 * IN_PERSON). Fires once per session (deduped via startReminderSentAt).
 */
export const sendSessionStartReminders = async (): Promise<number> => {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 60 * 60_000);
  const candidates = await ExpertSession.find({
    status: "SCHEDULED",
    scheduledAt: { $gte: now, $lte: soon },
    startReminderSentAt: { $exists: false },
  }).select("_id expertId userId scheduledAt mode meetingLink");
  let count = 0;
  for (const s of candidates) {
    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, startReminderSentAt: { $exists: false } },
      { $set: { startReminderSentAt: now } }
    );
    if (!updated) continue;
    count += 1;

    const when = new Date(s.scheduledAt as Date).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
    let clientDetail = "";
    let expertDetail = "";
    if (s.mode === "ONLINE") {
      clientDetail = s.meetingLink
        ? ` Join here: ${s.meetingLink}`
        : " Your expert hasn't shared a meeting link yet — check back shortly.";
      expertDetail = s.meetingLink
        ? ` Your meeting link: ${s.meetingLink}`
        : " Don't forget to add a meeting link.";
    } else if (s.mode === "IN_PERSON") {
      const expertDoc = await Expert.findById(s.expertId).select("inPersonAddress").lean();
      const address = (expertDoc as any)?.inPersonAddress;
      clientDetail = address
        ? ` Location: ${address}`
        : " Contact your expert for the exact location.";
    }

    notify(
      s.userId,
      "BOOKING_REMINDER",
      "Your session starts soon",
      `Your session is scheduled for ${when}.${clientDetail}`,
      { sessionId: s._id.toString() },
      true
    );

    const expertUserId = await expertUserIdOf(s.expertId);
    if (expertUserId) {
      notify(
        expertUserId,
        "BOOKING_REMINDER",
        "Your session starts soon",
        `Your session is scheduled for ${when}.${expertDetail}`,
        { sessionId: s._id.toString() },
        true
      );
    }
  }
  return count;
};

/**
 * Auto-release expert payouts 24 hours after session completion, mirroring
 * releaseCompletedBookingPayments() for venue/coach bookings. Anchored on
 * `completedAt` (not `updatedAt`, which a later review submission bumps).
 */
export const releaseExpertSessionPayouts = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const candidates = await ExpertSession.find({
    status: "COMPLETED",
    paymentStatus: "COMPLETED",
    payoutStatus: "PENDING",
    completedAt: { $lte: cutoff },
  }).select("_id expertId amount");
  let count = 0;
  for (const s of candidates) {
    const now = new Date();
    const updated = await ExpertSession.findOneAndUpdate(
      { _id: s._id, payoutStatus: "PENDING" },
      { $set: { payoutStatus: "PAID", payoutPaidAt: now } }
    );
    if (updated) {
      count += 1;
      await recordExpertSessionEvent(s, {
        type: "PAYOUT_RELEASED",
        toStatus: "COMPLETED",
        actorType: "SYSTEM",
        channel: "CRON",
        amountPaise: toPaise(s.amount),
        summary: "Expert payout auto-released 24h after completion",
        metadata: { manual: false, payoutPaidAt: now.toISOString() },
      });

      const expertUserId = await expertUserIdOf(s.expertId);
      if (expertUserId) {
        notify(
          expertUserId,
          "PAYOUT_PROCESSED",
          "Payout released",
          `Your payout of ₹${s.payoutNetAmount ?? s.amount} for a completed session has been released.`,
          { sessionId: s._id.toString() },
          true
        );
      }
    }
  }
  return count;
};

/** Nudge clients who completed a session but haven't reviewed (once). */
export const sendExpertReviewReminders = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sessions = await ExpertSession.find({
    status: "COMPLETED",
    reviewed: false,
    reviewReminderSentAt: { $exists: false },
    updatedAt: { $lte: cutoff },
  }).select("_id userId");
  let count = 0;
  for (const s of sessions) {
    notify(
      s.userId,
      "REVIEW_REMINDER",
      "Rate your expert session",
      "You haven't reviewed your recent expert session yet — your feedback helps other players.",
      { sessionId: s._id.toString() },
      true
    );
    await ExpertSession.updateOne({ _id: s._id }, { $set: { reviewReminderSentAt: new Date() } });
    count += 1;
  }
  return count;
};
