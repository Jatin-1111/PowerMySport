import type { StatusTone } from "@/modules/shared/ui/StatusTag";
import type { Expert, ExpertSession } from "@/modules/expert/services/expert";
import { formatSessionTime } from "./time";

export type SessionFilter = "upcoming" | "completed" | "cancelled" | "all";

/** The id the API may send as `id` or, from lean queries, `_id`. */
export const sessionKey = (session: ExpertSession, index = 0): string =>
  String(session.id || session._id || `row-${index}`);

/** A session the expert can still act on: paid, not yet completed or cancelled. */
export const isActive = (session: ExpertSession): boolean =>
  session.status === "PAID" || session.status === "SCHEDULED";

/** The client is waiting for the expert to accept, move or decline the time. */
export const needsResponse = (session: ExpertSession): boolean =>
  isActive(session) && session.expertAcceptance !== "ACCEPTED";

const startOf = (session: ExpertSession): number =>
  session.scheduledAt ? new Date(session.scheduledAt).getTime() : 0;

/** Requests waiting on the expert, soonest first. */
export const selectRequests = (sessions: ExpertSession[]): ExpertSession[] =>
  sessions.filter(needsResponse).sort((a, b) => startOf(a) - startOf(b));

/** Confirmed sessions that have not ended, soonest first. */
export const selectUpcoming = (
  sessions: ExpertSession[],
  now: Date,
  limit?: number
): ExpertSession[] => {
  const upcoming = sessions
    .filter((s) => isActive(s) && s.expertAcceptance === "ACCEPTED")
    .filter((s) => startOf(s) + (s.durationMinutes || 60) * 60_000 >= now.getTime())
    .sort((a, b) => startOf(a) - startOf(b));
  return limit ? upcoming.slice(0, limit) : upcoming;
};

/**
 * The sessions under the requests section: requests are shown on their own, so
 * they are never repeated here. Upcoming runs soonest first, the rest newest first.
 */
export const filterSessions = (sessions: ExpertSession[], filter: SessionFilter) => {
  const rest = sessions.filter((s) => !needsResponse(s));
  const matching =
    filter === "upcoming"
      ? rest.filter(isActive)
      : filter === "completed"
        ? rest.filter((s) => s.status === "COMPLETED")
        : filter === "cancelled"
          ? rest.filter((s) => s.status === "CANCELLED")
          : rest;
  return [...matching].sort((a, b) =>
    filter === "upcoming" ? startOf(a) - startOf(b) : startOf(b) - startOf(a)
  );
};

export const countByFilter = (sessions: ExpertSession[]): Record<SessionFilter, number> => ({
  upcoming: filterSessions(sessions, "upcoming").length,
  completed: filterSessions(sessions, "completed").length,
  cancelled: filterSessions(sessions, "cancelled").length,
  all: filterSessions(sessions, "all").length,
});

/** Fees from completed sessions, and from confirmed ones still to be held. */
export const sessionFigures = (sessions: ExpertSession[]) => {
  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const coming = sessions.filter(isActive);
  const sum = (list: ExpertSession[]) => list.reduce((total, s) => total + (s.amount || 0), 0);
  return {
    collected: sum(completed),
    completedCount: completed.length,
    stillToCome: sum(coming),
    comingCount: coming.length,
  };
};

export const sessionStatusView = (session: ExpertSession): { tone: StatusTone; tag: string } => {
  switch (session.status) {
    case "COMPLETED":
      return { tone: "neutral", tag: "Completed" };
    case "CANCELLED":
      return { tone: "alert", tag: "Cancelled" };
    case "PENDING_PAYMENT":
      return { tone: "pending", tag: "Awaiting payment" };
    default:
      return needsResponse(session)
        ? { tone: "pending", tag: "Needs your reply" }
        : { tone: "live", tag: "Confirmed" };
  }
};

/** "4 Jul 2026, 3:00 pm" in the expert's timezone, or a plain note when unscheduled. */
export const whenLabel = (session: ExpertSession): string =>
  session.scheduledAt
    ? formatSessionTime(session.scheduledAt, session.expertTimezone)
    : "Not scheduled yet";

/** Who the session is with: the child when the parent chose one, else the parent. */
export const sessionTitle = (session: ExpertSession): string =>
  session.player?.name || session.clientName || "Client";

export const modeLabel = (mode?: string): string =>
  mode === "ONLINE" ? "Online" : mode === "IN_PERSON" ? "In person" : "";

export type ExpertStatusView = {
  tone: StatusTone;
  tag: string;
  headline: string | null;
  body: string | null;
};

/** Where the expert's review stands. Only a profile that is not live gets a headline. */
export const describeExpertStatus = (expert: Expert): ExpertStatusView => {
  switch (expert.verificationStatus) {
    case "APPROVED":
      return expert.isActive
        ? { tone: "live", tag: "Live", headline: null, body: null }
        : {
            tone: "neutral",
            tag: "Inactive",
            headline: "Your profile is switched off",
            body: "Parents cannot book you while it is inactive. Contact us if you did not expect this.",
          };
    case "REJECTED":
      return {
        tone: "alert",
        tag: "Needs changes",
        headline: "Your profile needs changes",
        body: expert.rejectionReason || "Our team asked for changes before approving it.",
      };
    case "PENDING":
      return {
        tone: "pending",
        tag: "In review",
        headline: "Your profile is in review",
        body: "Our team is checking your details and documents. We email you as soon as there is a decision. You can keep updating your profile and availability meanwhile.",
      };
    default:
      return {
        tone: "neutral",
        tag: "Not submitted",
        headline: "Finish setting up your profile",
        body: "We start reviewing once every onboarding step is done and submitted.",
      };
  }
};

/** Days of the week with at least one availability window. */
export const openDays = (expert: Expert): number =>
  new Set((expert.weeklyAvailability ?? []).map((w) => w.dayOfWeek)).size;
