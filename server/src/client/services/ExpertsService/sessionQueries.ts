import { Expert } from "../../models/ExpertProfile";
import { Player } from "../../models/Player";
import { ExpertSession } from "../../models/ExpertBooking";
import {
  toObjectId,
  serializeExpert,
  serializeFullPlayerForExpert,
  fetchPlayerSummariesByIds,
  serializeSession,
} from "./shared";
import { assertExpertOperational } from "./sessionLifecycle";

// ── Reads ────────────────────────────────────────────────────────────────────

export const getExpertSessionForUser = async (params: {
  sessionId: string;
  userId: string;
  isAdmin?: boolean;
}) => {
  const session = await ExpertSession.findById(params.sessionId).lean();
  if (!session) throw new Error("Session not found");

  const expert = await Expert.findById(session.expertId).populate("userId", "name email").lean();
  const isClient = session.userId.toString() === params.userId;
  const isExpert = expert && (expert.userId as any)?._id?.toString() === params.userId;
  if (!isClient && !isExpert && !params.isAdmin) {
    throw new Error("You are not authorized to view this session");
  }
  const playerSummaries = await fetchPlayerSummariesByIds([session]);
  return serializeSession(session, {
    expert: expert ? serializeExpert(expert) : undefined,
    expertInPersonAddress: expert?.inPersonAddress,
    player: (session as any).playerId
      ? playerSummaries.get((session as any).playerId.toString())
      : undefined,
  });
};

/** Full child profile + roadmap narrative for the expert's booking-detail page. Expert-only. */
export const getExpertSessionPlayerDetail = async (params: {
  sessionId: string;
  expertUserId: string;
}) => {
  const session = await ExpertSession.findById(params.sessionId).lean();
  if (!session) throw new Error("Session not found");

  const expert = await Expert.findOne({
    userId: toObjectId(params.expertUserId),
  })
    .select("_id isActive verificationStatus")
    .lean();
  if (!expert || expert._id.toString() !== session.expertId.toString()) {
    throw new Error("You are not authorized to view this session");
  }
  assertExpertOperational(expert);

  if (!session.playerId) {
    throw new Error("No player profile is linked to this session");
  }

  const player = await Player.findById(session.playerId).lean();
  if (!player) throw new Error("Player profile not found");

  return {
    player: serializeFullPlayerForExpert(player),
  };
};

export const listUserExpertSessions = async (userId: string) => {
  const sessions = await ExpertSession.find({ userId: toObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean();
  const expertIds = [...new Set(sessions.map((s) => s.expertId.toString()))];
  const experts = await Expert.find({ _id: { $in: expertIds } })
    .populate("userId", "name email")
    .lean();
  const byId = new Map(experts.map((e) => [e._id.toString(), e]));
  const playerSummaries = await fetchPlayerSummariesByIds(sessions);
  return sessions.map((s) => {
    const e = byId.get(s.expertId.toString());
    return serializeSession(s, {
      expert: e ? serializeExpert(e) : undefined,
      expertInPersonAddress: e?.inPersonAddress,
      player: s.playerId ? playerSummaries.get(s.playerId.toString()) : undefined,
    });
  });
};

export const listExpertOwnSessions = async (expertUserId: string) => {
  const expert = await Expert.findOne({
    userId: toObjectId(expertUserId),
  }).select("_id timezone");
  if (!expert) return [];
  const tz = (expert as any).timezone || "Asia/Kolkata";
  const sessions = await ExpertSession.find({
    expertId: expert._id,
    // Only show sessions the client actually paid for — an unpaid hold
    // (PENDING_PAYMENT) or a failed payment was never a real booking from
    // the expert's point of view, just noise. A session cancelled after
    // payment succeeded is still shown (paymentStatus stays COMPLETED).
    paymentStatus: "COMPLETED",
  })
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .lean();
  const playerSummaries = await fetchPlayerSummariesByIds(sessions);
  return sessions.map((s) => {
    const u = s.userId as unknown as { name?: string } | null;
    return serializeSession(s, {
      clientName: u?.name || "Client",
      expertTimezone: tz,
      player: s.playerId ? playerSummaries.get(s.playerId.toString()) : undefined,
    });
  });
};

/** Admin: an expert's sessions plus an earnings summary. */
export const getExpertSessionsForAdmin = async (expertId: string) => {
  const expertDoc = await Expert.findById(expertId).select("timezone").lean();
  const tz = (expertDoc as any)?.timezone || "Asia/Kolkata";
  const sessions = await ExpertSession.find({ expertId: toObjectId(expertId) })
    .populate("userId", "name email")
    .sort({ createdAt: -1 })
    .lean();
  const paid = sessions.filter((s) => s.paymentStatus === "COMPLETED");
  const grossEarnings = paid.reduce((sum, s) => sum + (s.amount || 0), 0);
  const refundsPending = sessions
    .filter((s) => s.refundStatus === "REQUIRED")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const completedPaid = sessions.filter(
    (s) => s.status === "COMPLETED" && s.paymentStatus === "COMPLETED"
  );
  const payoutPending = completedPaid
    .filter((s) => (s.payoutStatus || "PENDING") === "PENDING")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const payoutReleased = completedPaid
    .filter((s) => s.payoutStatus === "PAID")
    .reduce((sum, s) => sum + (s.amount || 0), 0);
  const playerSummaries = await fetchPlayerSummariesByIds(sessions);
  const now = Date.now();
  // A SCHEDULED session whose end time has passed and still has no MOM —
  // it can no longer auto-complete, so this is the admin escalation signal.
  const isAwaitingMom = (s: (typeof sessions)[number]) => {
    if (s.status !== "SCHEDULED" || !s.scheduledAt) return false;
    const end = new Date(s.scheduledAt).getTime() + (s.durationMinutes || 60) * 60_000;
    return end < now;
  };
  return {
    sessions: sessions.map((s) => {
      const u = s.userId as unknown as { name?: string; email?: string } | null;
      return {
        ...serializeSession(s, {
          clientName: u?.name || "Client",
          expertTimezone: tz,
          player: s.playerId ? playerSummaries.get(s.playerId.toString()) : undefined,
        }),
        awaitingMom: isAwaitingMom(s),
      };
    }),
    summary: {
      total: sessions.length,
      completed: sessions.filter((s) => s.status === "COMPLETED").length,
      upcoming: sessions.filter((s) => s.status === "SCHEDULED").length,
      awaitingMom: sessions.filter(isAwaitingMom).length,
      grossEarnings,
      refundsPending,
      payoutPending,
      payoutReleased,
    },
  };
};
