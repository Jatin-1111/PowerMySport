import mongoose from "mongoose";
import { Expert } from "../../models/ExpertProfile";
import { ExpertSession, ExpertSessionCanceller } from "../../models/ExpertBooking";
import { initiatePhonePeRefund } from "../../../shared/services/PhonePeService";
import { recordExpertSessionEvent } from "../BookingEventService";
import { log, toPaise, notify, expertUserIdOf } from "./shared";
import {
  assertSessionOwner,
  assertExpertOperational,
  sessionHasEnded,
  withExpertSlotLock,
} from "./sessionLifecycle";

/**
 * Expert (or admin) responds to a client's booked session:
 *  - ACCEPT: confirm the client's chosen time.
 *  - DECLINE: cancel the session (paid → manual refund required) + notify.
 *  - RESCHEDULE: move to another open slot within the expert's availability.
 */
export const respondToExpertSession = async (params: {
  sessionId: string;
  expertUserId: string;
  isAdmin?: boolean | undefined;
  action: "ACCEPT" | "DECLINE" | "RESCHEDULE";
  scheduledAt?: string | undefined;
  reason?: string | undefined;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  const expert = await Expert.findById(session.expertId);
  if (!expert) throw new Error("Expert not found");
  if (
    !params.isAdmin &&
    (expert.userId as mongoose.Types.ObjectId).toString() !== params.expertUserId
  ) {
    throw new Error("Only the expert or an admin can respond to this session");
  }
  // DECLINE is a wind-down action (like cancel) and stays available
  // regardless of status — but ACCEPT/RESCHEDULE mean continuing to operate
  // as an expert, which requires still being active + approved.
  if (!params.isAdmin && params.action !== "DECLINE") {
    assertExpertOperational(expert);
  }
  if (!["PAID", "SCHEDULED"].includes(session.status)) {
    throw new Error("This session can no longer be modified");
  }
  const tz = expert.timezone || "Asia/Kolkata";

  const statusBeforeResponse = session.status;
  const actorTypeForResponse = params.isAdmin ? "ADMIN" : "PROVIDER";
  const channelForResponse = params.isAdmin ? "ADMIN_PANEL" : "PROVIDER_WEB";

  if (params.action === "ACCEPT") {
    session.expertAcceptance = "ACCEPTED";
    session.expertRespondedAt = new Date();
    if (session.scheduledAt) session.status = "SCHEDULED";
    await session.save();

    await recordExpertSessionEvent(session, {
      type: "PROVIDER_CONFIRMED",
      fromStatus: statusBeforeResponse,
      toStatus: session.status,
      actorType: actorTypeForResponse,
      actorUserId: params.expertUserId,
      channel: channelForResponse,
      summary: "Expert accepted the client's chosen time",
      metadata: {
        // Time-to-accept is the expert SLA metric; derivable from CREATED.
        respondedAt: session.expertRespondedAt?.toISOString(),
      },
    });

    notify(
      session.userId,
      "BOOKING_CONFIRMED",
      "Session confirmed",
      "Your expert confirmed your session time.",
      { sessionId: session._id.toString() },
      true
    );
    return session;
  }

  if (params.action === "DECLINE") {
    if (!params.isAdmin && sessionHasEnded(session)) {
      throw new Error("This session already took place and can no longer be declined.");
    }
    const declinedAt = new Date();
    session.status = "CANCELLED";
    session.cancelledAt = declinedAt;
    session.cancelledBy = "EXPERT";
    session.cancelReason = params.reason?.trim() || "The expert is unavailable at this time";
    session.expertAcceptance = "DECLINED";
    session.expertRespondedAt = declinedAt;
    if (session.paymentStatus === "COMPLETED") {
      session.refundStatus = "REQUIRED";
      if (session.scheduledAt) {
        session.cancellationNoticeHours = Math.round(
          (session.scheduledAt.getTime() - declinedAt.getTime()) / (60 * 60 * 1000)
        );
      }
    }
    await session.save();

    await recordExpertSessionEvent(session, {
      type: "PROVIDER_REJECTED",
      fromStatus: statusBeforeResponse,
      toStatus: "CANCELLED",
      actorType: actorTypeForResponse,
      actorUserId: params.expertUserId,
      channel: channelForResponse,
      amountPaise: toPaise(session.amount),
      summary:
        session.paymentStatus === "COMPLETED"
          ? "Expert declined a PAID session — manual refund required"
          : "Expert declined an unpaid session",
      metadata: {
        reason: session.cancelReason,
        refundStatus: session.refundStatus,
        cancellationNoticeHours: session.cancellationNoticeHours,
        wasPaid: session.paymentStatus === "COMPLETED",
      },
    });

    notify(
      session.userId,
      "BOOKING_CANCELLED",
      "Session declined",
      session.paymentStatus === "COMPLETED"
        ? "Your expert couldn't take this session. A refund will be processed manually by our team."
        : "Your expert couldn't take this session.",
      { sessionId: session._id.toString() },
      true
    );
    return session;
  }

  // RESCHEDULE
  if (!params.scheduledAt) throw new Error("A new time is required to reschedule");
  const when = new Date(params.scheduledAt);
  const previousScheduledAt = session.scheduledAt
    ? new Date(session.scheduledAt).toISOString()
    : null;
  await withExpertSlotLock(expert, when, session._id.toString(), async (dbSession) => {
    session.scheduledAt = when;
    session.status = "SCHEDULED";
    session.expertAcceptance = "ACCEPTED";
    session.expertRespondedAt = new Date();
    await session.save({ session: dbSession });
  });

  await recordExpertSessionEvent(session, {
    type: "RESCHEDULED",
    fromStatus: statusBeforeResponse,
    toStatus: session.status,
    actorType: actorTypeForResponse,
    actorUserId: params.expertUserId,
    channel: channelForResponse,
    summary: `Expert moved the session to ${when.toISOString()}`,
    metadata: {
      from: previousScheduledAt,
      to: when.toISOString(),
      initiatedBy: "EXPERT",
    },
  });

  notify(
    session.userId,
    "BOOKING_STATUS_UPDATED",
    "Session rescheduled",
    `Your expert moved your session to ${when.toLocaleString("en-IN", { timeZone: tz })}.`,
    { sessionId: session._id.toString() },
    true
  );
  return session;
};

export const cancelExpertSession = async (params: {
  sessionId: string;
  actorUserId: string;
  role?: string | undefined;
  reason?: string | undefined;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");

  const isAdmin = params.role === "Admin";
  const expert = await Expert.findById(session.expertId).select("userId");
  const isExpert = expert?.userId?.toString() === params.actorUserId;
  const isClient = session.userId.toString() === params.actorUserId;
  if (!isAdmin && !isExpert && !isClient) {
    throw new Error("You are not authorized to cancel this session");
  }
  if (session.status === "COMPLETED") throw new Error("A completed session cannot be cancelled");
  if (session.status === "CANCELLED") return session;
  // Once a session has actually taken place, cancelling it would auto-flag a
  // refund below — that's only safe before the session happens. Without an
  // auto-complete job, a session can otherwise sit SCHEDULED past its end
  // time (awaiting the expert's MOM), which would make it cancellable —
  // and refundable — well after the fact. Admin keeps override for disputes.
  if (!isAdmin && sessionHasEnded(session)) {
    throw new Error(
      "This session already took place and can no longer be cancelled. Contact support if it didn't actually happen."
    );
  }

  const by: ExpertSessionCanceller = isAdmin ? "ADMIN" : isExpert ? "EXPERT" : "CLIENT";
  const statusForCancelEvent = session.status;
  const cancelledAt = new Date();
  session.status = "CANCELLED";
  session.cancelledAt = cancelledAt;
  session.cancelledBy = by;
  session.cancelReason = params.reason?.trim();
  // Paid sessions require a manual refund (handled by admin/finance). We record
  // how much notice was given so admin can apply their own late-cancellation
  // judgment when processing it — the app never auto-forfeits the payment.
  if (session.paymentStatus === "COMPLETED") {
    session.refundStatus = "REQUIRED";
    if (session.scheduledAt) {
      session.cancellationNoticeHours = Math.round(
        (session.scheduledAt.getTime() - cancelledAt.getTime()) / (60 * 60 * 1000)
      );
    }
  }
  const statusBeforeCancel = statusForCancelEvent;
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "CANCELLED",
    fromStatus: statusBeforeCancel,
    toStatus: "CANCELLED",
    actorType: isAdmin ? "ADMIN" : isExpert ? "PROVIDER" : "USER",
    actorUserId: params.actorUserId,
    channel: isAdmin ? "ADMIN_PANEL" : isExpert ? "PROVIDER_WEB" : "CLIENT_WEB",
    amountPaise: toPaise(session.amount),
    summary: `Cancelled by ${by}${
      session.paymentStatus === "COMPLETED" ? " — paid session, manual refund required" : ""
    }`,
    metadata: {
      cancelledBy: by,
      reason: session.cancelReason,
      refundStatus: session.refundStatus,
      // Notice given is what admin uses to judge a late cancellation; there is
      // no automatic forfeit, so the number needs to survive in the record.
      cancellationNoticeHours: session.cancellationNoticeHours,
      wasPaid: session.paymentStatus === "COMPLETED",
    },
  });

  const expertUserId = expert?.userId?.toString();
  // Notify the other party.
  if (isClient && expertUserId) {
    notify(
      expertUserId,
      "BOOKING_CANCELLED",
      "Session cancelled",
      "A client cancelled their session with you.",
      { sessionId: session._id.toString() },
      true
    );
  } else {
    notify(
      session.userId,
      "BOOKING_CANCELLED",
      "Session cancelled",
      session.paymentStatus === "COMPLETED"
        ? "Your session was cancelled. A refund will be processed manually by our team."
        : "Your session was cancelled.",
      { sessionId: session._id.toString() },
      true
    );
  }
  return session;
};

const recomputeExpertRating = async (expertId: mongoose.Types.ObjectId) => {
  const agg = await ExpertSession.aggregate([
    {
      $match: {
        expertId,
        reviewed: true,
        reviewHidden: { $ne: true },
        rating: { $gte: 1 },
      },
    },
    {
      $group: {
        _id: "$expertId",
        avg: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
  const avg = agg[0]?.avg || 0;
  const count = agg[0]?.count || 0;
  await Expert.findByIdAndUpdate(expertId, {
    rating: Math.round(avg * 10) / 10,
    reviewCount: count,
  });
};

export const reviewExpertSession = async (params: {
  sessionId: string;
  userId: string;
  rating: number;
  review?: string;
  anonymous?: boolean;
}) => {
  const session = await ExpertSession.findById(params.sessionId);
  if (!session) throw new Error("Session not found");
  assertSessionOwner(session, params.userId);
  if (session.status !== "COMPLETED") throw new Error("You can only review a completed session");
  if (session.reviewed) throw new Error("You have already reviewed this session");
  if (params.rating < 1 || params.rating > 5) throw new Error("Rating must be between 1 and 5");

  session.reviewed = true;
  session.rating = params.rating;
  session.review = params.review?.trim();
  session.reviewAnonymous = Boolean(params.anonymous);
  session.reviewedAt = new Date();
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "REVIEW_SUBMITTED",
    toStatus: session.status,
    actorType: "USER",
    actorUserId: params.userId,
    channel: "CLIENT_WEB",
    summary: `Client left a ${params.rating}-star review`,
    metadata: {
      rating: params.rating,
      anonymous: Boolean(params.anonymous),
      hasWrittenReview: Boolean(session.review),
    },
  });

  await recomputeExpertRating(session.expertId);

  const expertUserId = await expertUserIdOf(session.expertId);
  if (expertUserId) {
    notify(
      expertUserId,
      "REVIEW_POSTED",
      "New review",
      `You received a ${params.rating}-star review.`,
      { sessionId: session._id.toString() }
    );
  }
  return session;
};

/** Admin: hide/unhide a review and recompute the aggregate rating. */
export const setReviewHidden = async (sessionId: string, hidden: boolean) => {
  const session = await ExpertSession.findById(sessionId);
  if (!session) throw new Error("Session not found");
  session.reviewHidden = hidden;
  await session.save();
  await recomputeExpertRating(session.expertId);
  return session;
};

/** Admin/finance: mark a required manual refund as done, triggering a PhonePe reversal where possible. */
export const markSessionRefundDone = async (sessionId: string) => {
  const session = await ExpertSession.findById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.refundStatus !== "REQUIRED") {
    throw new Error("This session has no pending refund");
  }

  if (session.merchantOrderId) {
    try {
      const refundMerchantId = `EXPERT-REFUND-${Date.now()}-${session._id.toString().slice(-6)}`;
      await initiatePhonePeRefund({
        merchantRefundId: refundMerchantId,
        originalMerchantOrderId: session.merchantOrderId,
        amount: session.amount, // ExpertSession.amount is in rupees
      });
    } catch (refundError) {
      log.error(
        `PhonePe refund failed for expert session ${sessionId} — manual transfer required:`,
        refundError
      );
      // Do not block the status update; the admin has acknowledged this refund
      // is required and will process it via bank transfer if PhonePe fails.
    }
  } else {
    log.warn(
      `Expert session ${sessionId} has no merchantOrderId — cannot auto-refund via PhonePe. Manual bank transfer required.`
    );
  }

  session.refundStatus = "MANUAL_DONE";
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "REFUND_COMPLETED",
    toStatus: session.status,
    actorType: "ADMIN",
    channel: "ADMIN_PANEL",
    amountPaise: toPaise(session.amount),
    summary: "Admin marked the manual refund as done",
    metadata: {
      merchantOrderId: session.merchantOrderId,
      refundStatus: "MANUAL_DONE",
    },
  });

  notify(
    session.userId,
    "PAYMENT_REFUND",
    "Refund processed",
    `Your refund of ₹${session.amount.toLocaleString("en-IN")} has been processed.`,
    { sessionId: session._id.toString() },
    true
  );
  return session;
};

/** Admin/finance: mark a completed session's payout to the expert as done (early, ahead of the 24h auto-release). */
export const markSessionPayoutDone = async (sessionId: string) => {
  const session = await ExpertSession.findById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "COMPLETED" || session.paymentStatus !== "COMPLETED") {
    throw new Error("This session has no payout to release");
  }
  if (session.payoutStatus === "PAID") {
    throw new Error("This session's payout has already been marked paid");
  }
  session.payoutStatus = "PAID";
  session.payoutPaidAt = new Date();
  await session.save();

  await recordExpertSessionEvent(session, {
    type: "PAYOUT_RELEASED",
    toStatus: session.status,
    actorType: "ADMIN",
    channel: "ADMIN_PANEL",
    amountPaise: toPaise(session.amount),
    summary: "Admin released the expert payout early, ahead of the 24h auto-release",
    metadata: { manual: true, payoutPaidAt: session.payoutPaidAt?.toISOString() },
  });

  const expertUserId = await expertUserIdOf(session.expertId);
  if (expertUserId) {
    notify(
      expertUserId,
      "PAYOUT_PROCESSED",
      "Payout released",
      `Your payout of ₹${session.payoutNetAmount ?? session.amount} for a completed session has been released.`,
      { sessionId: session._id.toString() },
      true
    );
  }
  return session;
};
