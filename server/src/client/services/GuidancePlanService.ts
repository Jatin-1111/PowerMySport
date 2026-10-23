import { AnalyticsEvent } from "../../admin/models/AnalyticsEvent";
import { isSupportedSport } from "../../shared/constants/supportedSports";
import {
  generateYouthSportsGuidance,
  type GuidanceRequest,
  type GuidanceResponse,
} from "../../shared/services/guidanceAiService";
import { PlanCheckInService } from "../../shared/services/PlanCheckInService";
import { log as __rootLog } from "../../utils/logger";
import { GuidanceSubmission, type GuidanceSubmissionDocument } from "../models/GuidanceSubmission";

const log = __rootLog.child("guidancePlan");

/**
 * Making a development plan: ask the model, add the checks that cost nothing, save it, and
 * schedule the check-in. The website's endpoint and the WhatsApp assistant both do exactly this,
 * so it lives here once and neither can drift from the other.
 */

// ─── Rule-based burnout risk — zero AI cost ───────────────────────────────────

const BURNOUT_THRESHOLDS: Array<{
  maxAge: number;
  medium: number;
  high: number;
}> = [
  { maxAge: 7, medium: 5, high: 8 },
  { maxAge: 9, medium: 8, high: 12 },
  { maxAge: 11, medium: 10, high: 15 },
  { maxAge: 13, medium: 14, high: 20 },
  { maxAge: 15, medium: 18, high: 25 },
  { maxAge: 21, medium: 22, high: 30 },
];

export function calculateBurnoutRisk(age: number, weeklyHours: number) {
  const bracket =
    BURNOUT_THRESHOLDS.find((t) => age <= t.maxAge) ??
    BURNOUT_THRESHOLDS[BURNOUT_THRESHOLDS.length - 1]!;

  if (weeklyHours >= bracket.high) {
    return {
      level: "high" as const,
      message: `${weeklyHours} hours/week is very high for a ${age}-year-old. Research shows this significantly raises the risk of burnout, overuse injuries, and early sport dropout.`,
      recommendations: [
        "Cap structured sport at 3–4 days/week with a certified coach",
        "Ensure at least 2 full rest days with zero sport activity",
        "Replace 20–30% of training with unstructured free play the child controls",
        "Watch for: loss of enthusiasm, persistent fatigue, unexplained pain, sleep problems",
        "Consult a sports physiotherapist to review the current training load",
      ],
    };
  }

  if (weeklyHours >= bracket.medium) {
    return {
      level: "medium" as const,
      message: `${weeklyHours} hours/week is on the higher end for a ${age}-year-old. Monitor closely for fatigue and enjoyment levels.`,
      recommendations: [
        "Ensure at least 1–2 complete rest days per week",
        "Balance structured training with free, child-directed play",
        "Do a weekly check-in: ask your child if they're enjoying training, not just performing",
      ],
    };
  }

  return {
    level: "low" as const,
    message: `${weeklyHours} hours/week is age-appropriate for a ${age}-year-old — a healthy foundation.`,
    recommendations: [],
  };
}

export type BurnoutRisk = ReturnType<typeof calculateBurnoutRisk>;

export type PlanWithBurnout = GuidanceResponse & { burnoutRisk: BurnoutRisk };

export type CreatePlanResult =
  | { status: "not_supported"; sport: string }
  | { status: "created"; submission: GuidanceSubmissionDocument; response: PlanWithBurnout };

export interface CreatePlanOptions {
  /** The account the plan is saved under. Absent for a guest, who gets no check-in. */
  userId?: string | undefined;
  /** Where the request came from, for the record of sports we do not cover yet. */
  source: "WEB" | "SERVER";
}

/**
 * Makes and saves a plan. A sport we do not cover is reported without calling the model and is
 * recorded so we can see what people ask for. A model failure throws and saves nothing. A
 * failure to schedule the check-in is logged and never fails the plan the parent is waiting for.
 */
export async function createGuidancePlan(
  request: GuidanceRequest,
  options: CreatePlanOptions
): Promise<CreatePlanResult> {
  const requestedSport = request.sport?.trim();
  if (requestedSport && !isSupportedSport(requestedSport)) {
    AnalyticsEvent.create({
      eventName: "unsupported_sport_search",
      metadata: { sport: requestedSport, source: "guidance" },
      source: options.source,
      ...(options.userId ? { userId: options.userId } : {}),
    }).catch(() => {});
    return { status: "not_supported", sport: requestedSport };
  }

  const guidance = await generateYouthSportsGuidance(request);

  // Enrich with server-computed fields (zero AI cost)
  const burnoutRisk = calculateBurnoutRisk(request.child_age, request.weekly_time_commitment);
  const response: PlanWithBurnout = { ...guidance, burnoutRisk };

  const submission = await GuidanceSubmission.create({
    request,
    response,
    ...(options.userId ? { userId: options.userId } : {}),
  });

  // Fire-and-forget: a scheduling failure shouldn't fail the plan the parent is waiting for.
  PlanCheckInService.scheduleFromGuidance({
    userId: options.userId,
    dependentId: request.dependent_id,
    sourceId: submission._id.toString(),
    sport: request.sport || "General",
    response,
  }).catch((err) => log.error("Failed to schedule plan check-in:", err));

  return { status: "created", submission, response };
}
