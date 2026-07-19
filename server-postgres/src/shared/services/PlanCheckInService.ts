import prisma from "../../lib/prisma";
import type { PlanCheckIn as PlanCheckInRow, PlanCheckInSource } from "@prisma/client";
import type { GuidanceResponse } from "./guidanceAiService";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SEASONAL_REVISIT_DAYS = 120; // ~4 months, for journey-length plans

interface ScheduleParams {
  userId: string;
  dependentId?: string | null | undefined;
  source: PlanCheckInSource;
  sourceId?: string | null | undefined;
  sport: string;
  title: string;
  signals: string[];
  checkInDueAt: Date;
}

export class PlanCheckInService {
  /** Creates the PlanCheckIn record and the scheduled email/in-app nudge that fires on its due date. */
  static async schedule(params: ScheduleParams): Promise<PlanCheckInRow> {
    const checkIn = await prisma.planCheckIn.create({
      data: {
        userId: params.userId,
        source: params.source,
        sport: params.sport,
        title: params.title,
        signals: params.signals,
        checkInDueAt: params.checkInDueAt,
        status: "active",
        ...(params.dependentId ? { dependentId: params.dependentId } : {}),
        ...(params.sourceId ? { sourceId: params.sourceId } : {}),
      },
    });

    await prisma.scheduledNotification.create({
      data: {
        userId: params.userId,
        type: "PLAN_CHECKIN",
        interval: "CUSTOM",
        scheduledFor: params.checkInDueAt,
        status: "PENDING",
        title: `How's ${params.sport} going?`,
        body: params.title,
        data: {
          checkInId: checkIn.id.toString(),
          sport: params.sport,
          signals: params.signals,
        },
        // channels object flattened onto columns
        chEmail: true,
        chInApp: true,
      },
    });

    return checkIn;
  }

  /**
   * Schedules the right follow-up nudge from a just-generated guidance
   * response — a short week-by-week plan gets a check-in at its own
   * successCheck horizon; a journey plan gets a longer seasonal revisit
   * instead of nothing. No-op if the response has neither shape (nothing to
   * check in on) or if userId is absent (guest — no email to reach them at).
   */
  static async scheduleFromGuidance(params: {
    userId?: string | null | undefined;
    dependentId?: string | null | undefined;
    sourceId: string;
    sport: string;
    response: GuidanceResponse;
  }): Promise<void> {
    if (!params.userId) return;
    const { response } = params;

    if (response.shortTermPlan && response.shortTermPlan.weeks?.length > 0) {
      const weeks =
        response.shortTermPlan.durationWeeks ||
        response.shortTermPlan.weeks.length;
      await this.schedule({
        userId: params.userId,
        dependentId: params.dependentId,
        source: "guidance_short_plan",
        sourceId: params.sourceId,
        sport: params.sport,
        title: `It's been ${weeks} week${weeks === 1 ? "" : "s"} since your ${params.sport} plan — here's how to check if it worked.`,
        signals: [response.shortTermPlan.successCheck].filter(Boolean) as string[],
        checkInDueAt: new Date(Date.now() + weeks * WEEK_MS),
      });
      return;
    }

    if (response.journeyPhases && response.journeyPhases.length > 0) {
      await this.schedule({
        userId: params.userId,
        dependentId: params.dependentId,
        source: "guidance_journey",
        sourceId: params.sourceId,
        sport: params.sport,
        title: `A few months ago we mapped out a plan for ${params.sport} — how's it going?`,
        signals: [
          response.goalAssessment?.statedGoal ||
            "Overall progress toward the goal",
        ].filter(Boolean) as string[],
        checkInDueAt: new Date(
          Date.now() + SEASONAL_REVISIT_DAYS * 24 * 60 * 60 * 1000,
        ),
      });
    }
  }

  /** What the client should do next, given the source and the parent's answer. */
  static computeFollowUp(checkIn: PlanCheckInRow):
    | { kind: "done"; message: string }
    | { kind: "try_next_sport"; message: string }
    | { kind: "re_diagnose"; message: string }
    | { kind: "escalate"; message: string; whatsappUrl: string | null } {
    const isFindSport = checkIn.source === "find_sport_trial";

    if (checkIn.status === "progressing") {
      return isFindSport
        ? { kind: "done", message: "That's great to hear — keep going." }
        : {
            kind: "done",
            message: "Great progress. Come back anytime for the next step.",
          };
    }

    if (checkIn.status === "abandoned") {
      return {
        kind: "done",
        message: "No problem — thanks for letting us know.",
      };
    }

    if (isFindSport) {
      return {
        kind: "try_next_sport",
        message:
          "Worth trying one of the other two sports we suggested instead?",
      };
    }

    if (checkIn.status === "not_progressing") {
      return {
        kind: "re_diagnose",
        message: "Let's take another look at what's actually going on.",
      };
    }

    // ambiguous
    return {
      kind: "escalate",
      message: "This is worth a real conversation with our team.",
      whatsappUrl: checkIn.sourceId
        ? `/api/guidance/${checkIn.sourceId}/whatsapp`
        : null,
    };
  }
}

export type { PlanCheckInStatus } from "@prisma/client";
