import crypto from "crypto";
import mongoose from "mongoose";
import { Expert, ExpertDocument } from "../../models/ExpertProfile";
import { commissionOn } from "../CommissionService";
import { Player } from "../../models/Player";
import { ExpertSession, ExpertSessionDocument } from "../../models/ExpertBooking";
import { BookingSlotLock } from "../../models/BookingSlotLock";
import {
  initiatePhonePePayment,
  getPhonePeOrderStatus,
} from "../../../shared/services/PhonePeService";
import { recordExpertSessionEvent } from "../BookingEventService";
import type { BookingEventChannel } from "../../models/BookingEvent";
import { assertSlotBookable } from "../ExpertAvailabilityService";
import {
  toObjectId,
  frontendUrl,
  toPaise,
  notify,
  expertUserIdOf,
  isRetryableTransactionError,
} from "./shared";

const HOLD_MINUTES = 15;

// ── Session lifecycle ────────────────────────────────────────────────────────

export const assertSessionOwner = (session: ExpertSessionDocument, userId: string) => {
  if (session.userId.toString() !== userId) {
    throw new Error("You are not authorized to modify this session");
  }
};

/**
 * A session's expert-side "keep operating" actions (accepting/rescheduling,
 * marking complete, sharing a meeting link, reading the child's profile) all
 * require the expert to still be an active, approved account — not just the
 * original owner of the session. Getting rejected after a booking already
 * exists should cut off further ability to act as their expert, not just
 * remove them from public discovery. Declining or cancelling stays allowed
 * regardless of status, since ending a session is the safe direction.
 */
export const assertExpertOperational = (expert: {
  verificationStatus: string;
  isActive: boolean;
}) => {
  if (!expert.isActive || expert.verificationStatus !== "APPROVED") {
    throw new Error("Your expert account is not currently active — contact support.");
  }
};

/** Whether a session's scheduled end time has already passed (or it was never scheduled at all). */
export const sessionHasEnded = (session: {
  scheduledAt?: Date | null;
  durationMinutes?: number;
}): boolean => {
  if (!session.scheduledAt) return false;
  const end = new Date(session.scheduledAt).getTime() + (session.durationMinutes || 60) * 60_000;
  return end < Date.now();
};

// ── Slot-locking (double-booking race prevention) ─────────────────────────────
// assertSlotBookable's conflict check and the subsequent write aren't atomic
// on their own — two concurrent requests for the identical expert+time could
// both read "no conflict" before either write commits. This mirrors the
// BookingSlotLock mechanism BookingService.ts already uses for venue/coach
// bookings: acquire a per-slot lock inside a transaction (which serializes
// concurrent transactions on the same lock document), re-validate, then
// mutate — all committed together, or none of it.

const MAX_SLOT_LOCK_RETRIES = 3;

/**
 * Reserve `scheduledAt` for `expert` and run `mutate` — both atomically. Retries
 * a bounded number of times on transient transaction errors (e.g. a write
 * conflict from a competing request racing for the same lock document).
 */
export const withExpertSlotLock = async <T>(
  expert: ExpertDocument,
  scheduledAt: Date,
  excludeSessionId: string | undefined,
  mutate: (dbSession: mongoose.ClientSession) => Promise<T>
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_SLOT_LOCK_RETRIES; attempt += 1) {
    const dbSession = await mongoose.startSession();
    try {
      let result: T | undefined;
      await dbSession.withTransaction(async () => {
        await BookingSlotLock.findOneAndUpdate(
          {
            resourceType: "EXPERT_SLOT",
            resourceId: expert._id,
            dateKey: scheduledAt.toISOString(),
          },
          {
            $inc: { version: 1 },
            $set: { lastLockedAt: new Date() },
          },
          {
            upsert: true,
            new: true,
            session: dbSession,
            setDefaultsOnInsert: true,
          }
        );

        // Re-validate now that we hold the lock — no concurrent request for
        // this exact slot can commit ahead of us from this point on.
        await assertSlotBookable(expert, scheduledAt, excludeSessionId, dbSession);

        result = await mutate(dbSession);
      });
      return result as T;
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_SLOT_LOCK_RETRIES) {
        throw error;
      }
    } finally {
      await dbSession.endSession();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to reserve this slot after multiple attempts");
};

export const initiateExpertSession = async (params: {
  expertId: string;
  userId: string;
  scheduledAt: string;
  clientNote?: string;
  mode?: "ONLINE" | "IN_PERSON";
  userPhone?: string;
  playerId?: string;
}) => {
  const expert = await Expert.findById(params.expertId);
  if (!expert || !expert.isActive) throw new Error("Expert not found");
  if (params.userId === (expert.userId as mongoose.Types.ObjectId).toString()) {
    throw new Error("You cannot book a session with yourself");
  }

  const scheduledAt = new Date(params.scheduledAt);

  // Only attach the player if it's actually one of this parent's own children —
  // silently drop it otherwise rather than failing the whole booking.
  let playerId: mongoose.Types.ObjectId | undefined;
  if (params.playerId) {
    const player = await Player.findOne({
      _id: params.playerId,
      userId: toObjectId(params.userId),
      type: "DEPENDENT",
    }).select("_id");
    if (player) playerId = player._id as mongoose.Types.ObjectId;
  }

  const merchantOrderId = `EXP_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const resolvedMode =
    expert.sessionMode === "BOTH"
      ? params.mode || "ONLINE"
      : expert.sessionMode === "IN_PERSON"
        ? "IN_PERSON"
        : "ONLINE";

  const session = await withExpertSlotLock(expert, scheduledAt, undefined, async (dbSession) => {
    const [doc] = await ExpertSession.create(
      [
        {
          expertId: expert._id,
          userId: toObjectId(params.userId),
          ...(playerId ? { playerId } : {}),
          amount: expert.sessionFee,
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          merchantOrderId,
          scheduledAt,
          durationMinutes: expert.sessionDurationMinutes || 60,
          holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
          mode: resolvedMode,
          clientNote: params.clientNote?.trim(),
        },
      ],
      { session: dbSession }
    );
    return doc;
  });

  await recordExpertSessionEvent(session, {
    type: "CREATED",
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    amountPaise: toPaise(expert.sessionFee),
    summary: `Expert session held for ${new Date(scheduledAt).toISOString()} (${resolvedMode})`,
    metadata: {
      merchantOrderId,
      mode: resolvedMode,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes: expert.sessionDurationMinutes || 60,
      holdExpiresAt: session.holdExpiresAt?.toISOString(),
      hasPlayer: Boolean(playerId),
      hasClientNote: Boolean(params.clientNote?.trim()),
    },
  });

  const payment = await initiatePhonePePayment({
    merchantOrderId,
    amount: toPaise(expert.sessionFee),
    redirectUrl: `${frontendUrl()}/experts/sessions/${session._id}`,
    ...(params.userPhone ? { userPhone: params.userPhone } : {}),
  });

  await recordExpertSessionEvent(session, {
    type: "PAYMENT_INITIATED",
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    amountPaise: toPaise(expert.sessionFee),
    summary: "PhonePe payment initiated for expert session",
    metadata: { merchantOrderId, method: "PHONEPE" },
  });

  return {
    sessionId: session._id.toString(),
    redirectUrl: payment.redirectUrl,
  };
};

/**
 * Idempotently transition a session to a paid+scheduled state and fire the
 * one-time confirmation notifications. Safe to call from both the client-driven
 * reconcile and the webhook path.
 */
export const applyExpertPaymentSuccess = async (
  session: ExpertSessionDocument,
  /**
   * Which surface drove this. Both the webhook and the client-side reconcile
   * land here, and a log that can't tell them apart hides whether the gateway
   * callback is actually working.
   */
  source: { channel: BookingEventChannel; actorUserId?: string } = {
    channel: "WEBHOOK",
  }
): Promise<ExpertSessionDocument> => {
  const wasPaid = session.paymentStatus === "COMPLETED";
  const statusBefore = session.status;
  session.paymentStatus = "COMPLETED";
  if (!wasPaid) session.paidAt = new Date();
  session.set("holdExpiresAt", undefined);
  if (session.status === "PENDING_PAYMENT") {
    session.status = session.scheduledAt ? "SCHEDULED" : "PAID";
  }
  await session.save();

  // Only on the real transition — this function is deliberately idempotent and
  // is called repeatedly by reconcile/webhook, so logging unconditionally would
  // fill the timeline with duplicate confirmations.
  if (!wasPaid) {
    await recordExpertSessionEvent(session, {
      type: "PAYMENT_CONFIRMED",
      fromStatus: statusBefore,
      toStatus: session.status,
      actorType: "GATEWAY",
      ...(source.actorUserId ? { actorUserId: source.actorUserId } : {}),
      channel: source.channel,
      amountPaise: toPaise(session.amount),
      summary: "Expert session payment confirmed",
      metadata: {
        merchantOrderId: session.merchantOrderId,
        scheduledAt: session.scheduledAt ? new Date(session.scheduledAt).toISOString() : null,
      },
    });
  }

  if (!wasPaid) {
    const when = session.scheduledAt
      ? new Date(session.scheduledAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "a time you choose";
    // Client receipt.
    notify(
      session.userId,
      "PAYMENT_CONFIRMED",
      "Session booked",
      `Your payment of ₹${session.amount} is confirmed. Your session is set for ${when}.`,
      { sessionId: session._id.toString(), amount: session.amount },
      true
    );
    // Expert alert.
    const expertUserId = await expertUserIdOf(session.expertId);
    if (expertUserId) {
      const hasContext = Boolean(session.playerId || session.clientNote);
      notify(
        expertUserId,
        "BOOKING_CONFIRMED",
        "New session booked",
        `A client booked a paid session with you for ${when}.` +
          (hasContext
            ? " Check your dashboard for their child's profile and note before the call."
            : ""),
        { sessionId: session._id.toString() },
        true
      );
    }
  }
  return session;
};

export const reconcileExpertSession = async (params: {
  sessionId: string;
  userId: string;
}): Promise<ExpertSessionDocument> => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.paymentStatus === "COMPLETED") return session;

  const status = await getPhonePeOrderStatus(session.merchantOrderId);
  const state = (status.state || "").toUpperCase();
  if (["COMPLETED", "SUCCESS", "PAYMENT_SUCCESS"].includes(state)) {
    return applyExpertPaymentSuccess(session, {
      channel: "CLIENT_WEB",
      actorUserId: params.userId,
    });
  } else if (["FAILED", "PAYMENT_ERROR", "PAYMENT_DECLINED"].includes(state)) {
    session.paymentStatus = "FAILED";
    if (session.status === "PENDING_PAYMENT") {
      session.status = "CANCELLED";
      session.cancelledBy = "SYSTEM";
      session.cancelReason = "Payment failed";
      session.cancelledAt = new Date();
      session.set("holdExpiresAt", undefined);
    }
    await session.save();
  }
  return session;
};

/** Reschedule a paid/scheduled session to another open slot. */
export const scheduleExpertSession = async (params: {
  sessionId: string;
  userId: string;
  scheduledAt: string;
  mode?: "ONLINE" | "IN_PERSON";
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("Only a paid session can be scheduled");
  }
  const expert = await Expert.findById(session.expertId);
  if (!expert) throw new Error("Expert not found");

  const when = new Date(params.scheduledAt);
  const previousSlot = session.scheduledAt ? new Date(session.scheduledAt).toISOString() : null;
  const previousStatus = session.status;
  const previousMode = session.mode;

  await withExpertSlotLock(expert, when, session._id.toString(), async (dbSession) => {
    session.scheduledAt = when;
    session.status = "SCHEDULED";
    if (params.mode) session.mode = params.mode;
    await session.save({ session: dbSession });
  });

  await recordExpertSessionEvent(session, {
    type: "RESCHEDULED",
    fromStatus: previousStatus,
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    summary: previousSlot
      ? `Client moved the session from ${previousSlot} to ${when.toISOString()}`
      : `Client scheduled the session for ${when.toISOString()}`,
    metadata: {
      from: previousSlot,
      to: when.toISOString(),
      ...(params.mode && params.mode !== previousMode
        ? { modeChangedFrom: previousMode, modeChangedTo: params.mode }
        : {}),
    },
  });

  const expertUserId = (expert.userId as mongoose.Types.ObjectId).toString();
  notify(
    expertUserId,
    "BOOKING_STATUS_UPDATED",
    "Session scheduled",
    `A session was scheduled for ${when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}.`,
    { sessionId: session._id.toString() }
  );
  return session;
};

// Minimum length (after trimming) for an expert's minutes-of-meeting text —
// enough to stop a one-word close-out, not a rigid content requirement.
const MOM_MIN_LENGTH = 20;

const assertValidMom = (momNotes: unknown): string => {
  const trimmed = typeof momNotes === "string" ? momNotes.trim() : "";
  if (trimmed.length < MOM_MIN_LENGTH) {
    throw new Error(
      `Minutes of meeting must be at least ${MOM_MIN_LENGTH} characters — summarize what was covered and any next steps.`
    );
  }
  return trimmed;
};

/**
 * Complete a session. Requires minutes of meeting (MOM) — a session cannot be
 * marked COMPLETED without them, so the parent always has notes to read.
 */
export const completeExpertSession = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
  momNotes: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await Expert.findById(session.expertId).select(
      "userId isActive verificationStatus"
    );
    if (!expert || expert.userId.toString() !== params.actorUserId) {
      throw new Error("Only the expert or an admin can complete this session");
    }
    assertExpertOperational(expert);
  }
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("Session cannot be completed from its current state");
  }
  if (!params.isAdmin && (!session.scheduledAt || session.scheduledAt > new Date())) {
    throw new Error("You can only complete a session once it has started.");
  }
  const momNotes = assertValidMom(params.momNotes);
  const now = new Date();
  const statusBeforeCompletion = session.status;
  session.status = "COMPLETED";
  session.completedAt = now;
  session.momNotes = momNotes;
  session.momAddedAt = now;

  // Fix the platform's commission at completion, so a later rate change cannot
  // retroactively alter what this session pays — the Partner Terms promise
  // exactly that ("bookings already confirmed at the old rate are settled at
  // the old rate"). `amount` is rupees; the engine works in whole paise.
  const commission = commissionOn(Math.round((session.amount || 0) * 100));
  session.payoutGrossAmount = commission.partnerFeePaise / 100;
  session.payoutCommissionRate = commission.rate;
  session.payoutCommissionAmount = commission.commissionPaise / 100;
  session.payoutCommissionGstAmount = commission.gstOnCommissionPaise / 100;
  session.payoutNetAmount = commission.netPayablePaise / 100;

  await session.save();

  await recordExpertSessionEvent(session, {
    type: "COMPLETED",
    fromStatus: statusBeforeCompletion,
    toStatus: "COMPLETED",
    actorType: params.isAdmin ? "ADMIN" : "PROVIDER",
    actorUserId: params.actorUserId,
    channel: params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB",
    amountPaise: toPaise(session.amount),
    summary: "Expert marked the session complete and filed minutes of meeting",
    metadata: {
      momLength: momNotes.length,
      scheduledAt: session.scheduledAt ? new Date(session.scheduledAt).toISOString() : null,
      // Completion starts the 24h payout clock, so this is the anchor event
      // for any later "why hasn't the expert been paid" question.
      payoutEligibleAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  notify(
    session.userId,
    "SESSION_MOM_ADDED",
    "Session notes are ready",
    "Your expert session is complete and your expert's notes (minutes of meeting) are ready to read. Leave a rating and feedback too.",
    { sessionId: session._id.toString() },
    true
  );
  return session;
};

/**
 * Let the expert revise their MOM after completion — no lock, since notes
 * are commonly refined after the fact (e.g. fixing a typo, adding a detail).
 */
export const updateExpertSessionMom = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
  momNotes: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await Expert.findById(session.expertId).select(
      "userId isActive verificationStatus"
    );
    if (!expert || expert.userId.toString() !== params.actorUserId) {
      throw new Error("Only the expert or an admin can edit these notes");
    }
    assertExpertOperational(expert);
  }
  if (session.status !== "COMPLETED") {
    throw new Error("Notes can only be edited on a completed session");
  }
  const previousMomLength = session.momNotes?.length ?? 0;
  session.momNotes = assertValidMom(params.momNotes);
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "MOM_ADDED",
    toStatus: session.status,
    actorType: params.isAdmin ? "ADMIN" : "PROVIDER",
    actorUserId: params.actorUserId,
    channel: params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB",
    summary: "Minutes of meeting revised after completion",
    metadata: {
      revision: true,
      previousLength: previousMomLength,
      newLength: session.momNotes.length,
    },
  });

  return session;
};

export const setSessionMeetingLink = async (params: {
  sessionId: string;
  actorUserId: string;
  isAdmin?: boolean;
  meetingLink: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  if (!params.isAdmin) {
    const expert = await Expert.findById(session.expertId).select(
      "userId isActive verificationStatus"
    );
    if (!expert || expert.userId.toString() !== params.actorUserId) {
      throw new Error("Only the expert or an admin can set the meeting link");
    }
    assertExpertOperational(expert);
  }
  const link = params.meetingLink.trim();
  if (link && !/^https?:\/\//i.test(link)) {
    throw new Error("Meeting link must be a valid URL");
  }
  const hadLink = Boolean(session.meetingLink);
  session.meetingLink = link;
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "MEETING_LINK_SET",
    toStatus: session.status,
    actorType: params.isAdmin ? "ADMIN" : "PROVIDER",
    actorUserId: params.actorUserId,
    channel: params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB",
    summary: link ? `Meeting link ${hadLink ? "updated" : "added"}` : "Meeting link cleared",
    // The URL itself is deliberately not stored — it is a live join link, and
    // an append-only log is the wrong place to keep one indefinitely.
    metadata: { replaced: hadLink, cleared: !link },
  });

  notify(
    session.userId,
    "BOOKING_STATUS_UPDATED",
    "Meeting link added",
    "Your expert added a meeting link for your upcoming session.",
    { sessionId: session._id.toString() },
    true
  );
  return session;
};
