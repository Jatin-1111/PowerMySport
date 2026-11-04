import { Expert } from "../../models/ExpertProfile";
import { Player } from "../../models/Player";
import { ExpertSession } from "../../models/ExpertBooking";
import {
  log,
  toObjectId,
  serializeExpert,
  withFreshPhoto,
  serializeFullPlayerForExpert,
  fetchPlayerSummariesByIds,
  playerForSession,
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
    expert: expert ? await withFreshPhoto(serializeExpert(expert), expert) : undefined,
    expertInPersonAddress: expert?.inPersonAddress,
    player: playerForSession(session, playerSummaries),
  });
};

/**
 * How long after a session ends the expert can still open the child's full profile.
 * Long enough to write the session notes, short enough that a stale booking does
 * not leave a child's date of birth and medical conditions readable for good.
 */
export const CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION = 14;

/**
 * A child's full profile (date of birth, medical conditions, height, weight) goes
 * to the expert only for a session that was paid for and was not cancelled or
 * declined, and only until a short time after it ends. The list view already hid
 * unpaid holds; this closes the same gap on the detail view.
 */
export const assertExpertMayReadChildProfile = (
  session: {
    paymentStatus?: string;
    status?: string;
    expertAcceptance?: string;
    scheduledAt?: Date | string | null;
    durationMinutes?: number;
  },
  now: Date = new Date()
): void => {
  if (session.paymentStatus !== "COMPLETED") {
    throw new Error("The child's profile is available once the session is paid for");
  }
  if (session.status === "CANCELLED" || session.expertAcceptance === "DECLINED") {
    throw new Error("The child's profile is not available for a cancelled or declined session");
  }
  if (!session.scheduledAt) {
    throw new Error("The child's profile is available once the session has a scheduled time");
  }
  const endsAt = new Date(session.scheduledAt).getTime() + (session.durationMinutes || 60) * 60_000;
  const closesAt = endsAt + CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION * 24 * 60 * 60_000;
  if (now.getTime() > closesAt) {
    throw new Error(
      `The child's profile is only available for ${CHILD_PROFILE_ACCESS_DAYS_AFTER_SESSION} days after the session`
    );
  }
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
  assertExpertMayReadChildProfile(session);

  if (!session.playerId) {
    throw new Error(
      (session as any).playerSnapshot
        ? "The parent has deleted this child's profile"
        : "No player profile is linked to this session"
    );
  }

  const player = await Player.findById(session.playerId).lean();
  if (!player) throw new Error("Player profile not found");

  // An access record without any of the child's details, so a read can be traced later.
  log.info(`Expert ${expert._id} opened the child profile for session ${session._id}`);

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
  return Promise.all(
    sessions.map(async (s) => {
      const e = byId.get(s.expertId.toString());
      return serializeSession(s, {
        expert: e ? await withFreshPhoto(serializeExpert(e), e) : undefined,
        expertInPersonAddress: e?.inPersonAddress,
        player: playerForSession(s, playerSummaries),
      });
    })
  );
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
      player: playerForSession(s, playerSummaries),
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
          player: playerForSession(s, playerSummaries),
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
