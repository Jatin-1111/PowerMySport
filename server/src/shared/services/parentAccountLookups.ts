import { Expert } from "../../client/models/ExpertProfile";
import { ExpertSession } from "../../client/models/ExpertBooking";
import { GuidanceSubmission } from "../../client/models/GuidanceSubmission";
import { Player } from "../../client/models/Player";
import { dateOnly, firstName, pickChildren, type ChildLookup } from "./parentContext";
import { formatIstDateTime } from "./whatsappTemplates";

/**
 * The AI development plan and the expert sessions a parent already has, for the assistant
 * to read back on request. First names only, and nothing that pays for or joins a session:
 * no amount, no meeting link, no in-person address. A parent who needs those opens their
 * dashboard.
 */

const MAX_PLANS = 3;
const MAX_UPCOMING = 5;
const MAX_RECENT = 3;
const MAX_PHASES = 5;

/** Long AI text trimmed at a word, so the reply stays short and never ends mid-word. */
const brief = (text: string | undefined, max: number): string | undefined => {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "")}...`;
};

export interface GuidancePlanSummary {
  child: string;
  sport?: string;
  madeOn: string;
  goal?: { stated?: string; verdict?: string; why?: string };
  profileAnalysis?: string;
  coachingStyle?: string;
  weeklyBlueprint: { trainingHours: string; freePlayHours: string; restDays: string };
  recommendedSports: string[];
  burnoutRisk?: { level?: string; message?: string };
  journey: Array<{ title?: string; timeframe?: string; focus?: string }>;
  shortTermPlan?: { weeks?: number; successCheck?: string };
  /** The plan's own estimates, as the AI wrote them. */
  estimatedCosts?: { coaching?: string; equipment?: string; tournaments?: string };
}

/** The newest AI plan for each child, so "what was his plan" does not return a stale one. */
export async function getGuidancePlans(
  userId: string,
  childName?: string
): Promise<ChildLookup<GuidancePlanSummary>> {
  const players = await Player.find({ userId }).select("name").sort({ createdAt: 1 }).lean();
  const picked = pickChildren(players, childName);
  if (!picked.found) return picked;

  const nameOf = new Map(players.map((player) => [String(player._id), player.name]));
  const wanted = new Set(picked.items.map((player) => String(player._id)));
  const recent = await GuidanceSubmission.find({ userId }).sort({ createdAt: -1 }).limit(15).lean();

  const seen = new Set<string>();
  const items: GuidancePlanSummary[] = [];
  for (const submission of recent) {
    const dependentId = submission.request?.dependent_id
      ? String(submission.request.dependent_id)
      : "";
    // A plan for a child who is no longer on the account, or not the one asked about, is skipped.
    if (dependentId && !wanted.has(dependentId)) continue;
    if (!dependentId && childName) continue;
    const key = dependentId || "unspecified";
    if (seen.has(key)) continue;
    seen.add(key);

    const { response, request } = submission;
    items.push({
      child: dependentId ? firstName(nameOf.get(dependentId), "your child") : "your child",
      ...(request?.sport ? { sport: request.sport } : {}),
      madeOn: dateOnly(submission.createdAt)!,
      ...(response.goalAssessment?.statedGoal || response.goalAssessment?.verdict
        ? {
            goal: {
              ...(response.goalAssessment.statedGoal
                ? { stated: response.goalAssessment.statedGoal }
                : {}),
              ...(response.goalAssessment.verdict
                ? { verdict: response.goalAssessment.verdict }
                : {}),
              ...(brief(response.goalAssessment.rationale, 300)
                ? { why: brief(response.goalAssessment.rationale, 300)! }
                : {}),
            },
          }
        : {}),
      ...(brief(response.profileAnalysis, 500)
        ? { profileAnalysis: brief(response.profileAnalysis, 500)! }
        : {}),
      ...(brief(response.idealCoachingStyle, 250)
        ? { coachingStyle: brief(response.idealCoachingStyle, 250)! }
        : {}),
      weeklyBlueprint: {
        trainingHours: response.weeklyBlueprint.trainingHours,
        freePlayHours: response.weeklyBlueprint.freePlayHours,
        restDays: response.weeklyBlueprint.restDays,
      },
      recommendedSports: response.recommendedSports ?? [],
      ...(response.burnoutRisk?.level
        ? {
            burnoutRisk: {
              level: response.burnoutRisk.level,
              ...(brief(response.burnoutRisk.message, 200)
                ? { message: brief(response.burnoutRisk.message, 200)! }
                : {}),
            },
          }
        : {}),
      journey: (response.journeyPhases ?? []).slice(0, MAX_PHASES).map((phase) => ({
        ...(phase.title ? { title: phase.title } : {}),
        ...(phase.timeframe ? { timeframe: phase.timeframe } : {}),
        ...(brief(phase.focus, 160) ? { focus: brief(phase.focus, 160)! } : {}),
      })),
      ...(response.shortTermPlan?.durationWeeks || response.shortTermPlan?.successCheck
        ? {
            shortTermPlan: {
              ...(response.shortTermPlan.durationWeeks
                ? { weeks: response.shortTermPlan.durationWeeks }
                : {}),
              ...(brief(response.shortTermPlan.successCheck, 200)
                ? { successCheck: brief(response.shortTermPlan.successCheck, 200)! }
                : {}),
            },
          }
        : {}),
      ...(response.costBreakdown
        ? {
            estimatedCosts: {
              ...(response.costBreakdown.monthlyCoaching
                ? { coaching: response.costBreakdown.monthlyCoaching }
                : {}),
              ...(response.costBreakdown.equipment
                ? { equipment: response.costBreakdown.equipment }
                : {}),
              ...(response.costBreakdown.tournaments
                ? { tournaments: response.costBreakdown.tournaments }
                : {}),
            },
          }
        : {}),
    });
    if (items.length >= MAX_PLANS) break;
  }
  return { found: true, items };
}

export interface SessionSummary {
  with: string;
  forChild?: string;
  when?: string;
  minutes: number;
  mode?: string;
  status:
    | "booked"
    | "confirmed by the expert"
    | "declined by the expert"
    | "completed"
    | "cancelled"
    | "time has passed, not marked completed";
}

export interface SessionsOverview {
  upcoming: SessionSummary[];
  recent: SessionSummary[];
}

/** Upcoming sessions soonest first, then the last few that ended or were cancelled. */
export async function getSessionsOverview(
  userId: string,
  now: Date = new Date()
): Promise<SessionsOverview> {
  // A booking still waiting for payment is not a session yet and is left out.
  const sessions = await ExpertSession.find({
    userId,
    status: { $in: ["PAID", "SCHEDULED", "COMPLETED", "CANCELLED"] },
  })
    .sort({ scheduledAt: -1 })
    .limit(30)
    .lean();

  const [experts, players] = await Promise.all([
    Expert.find({ _id: { $in: sessions.map((s: { expertId: unknown }) => s.expertId) } })
      .select("userId")
      .populate("userId", "name")
      .lean(),
    Player.find({ userId }).select("name").lean(),
  ]);
  const expertName = new Map(
    (experts as Array<{ _id: unknown; userId?: { name?: string } }>).map((expert) => [
      String(expert._id),
      firstName(expert.userId?.name, "an expert"),
    ])
  );
  const childName = new Map(players.map((player) => [String(player._id), player.name]));

  const summarise = (session: (typeof sessions)[number]): SessionSummary => {
    const child = session.playerSnapshot?.name ?? childName.get(String(session.playerId ?? ""));
    const status: SessionSummary["status"] =
      session.status === "CANCELLED"
        ? "cancelled"
        : session.status === "COMPLETED"
          ? "completed"
          : session.scheduledAt && new Date(session.scheduledAt) < now
            ? "time has passed, not marked completed"
            : session.expertAcceptance === "ACCEPTED"
              ? "confirmed by the expert"
              : session.expertAcceptance === "DECLINED"
                ? "declined by the expert"
                : "booked";
    return {
      with: expertName.get(String(session.expertId)) ?? "an expert",
      ...(child ? { forChild: firstName(child, "your child") } : {}),
      ...(session.scheduledAt
        ? { when: formatIstDateTime(new Date(session.scheduledAt).toISOString()) }
        : {}),
      minutes: session.durationMinutes,
      ...(session.mode ? { mode: session.mode === "ONLINE" ? "online" : "in person" } : {}),
      status,
    };
  };

  const isUpcoming = (session: (typeof sessions)[number]) =>
    (session.status === "PAID" || session.status === "SCHEDULED") &&
    !!session.scheduledAt &&
    new Date(session.scheduledAt) >= now;

  return {
    upcoming: sessions
      .filter(isUpcoming)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
      .slice(0, MAX_UPCOMING)
      .map(summarise),
    recent: sessions
      .filter((session) => !isUpcoming(session))
      .slice(0, MAX_RECENT)
      .map(summarise),
  };
}
