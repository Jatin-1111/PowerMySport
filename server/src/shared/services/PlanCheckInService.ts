import mongoose from "mongoose";
import {
  PlanCheckIn,
  PlanCheckInDocument,
  PlanCheckInSource,
  PlanCheckInStatus,
} from "../models/PlanCheckIn";
import { ScheduledNotification } from "../../client/models/ScheduledNotification";
import type { GuidanceResponse } from "./guidanceAiService";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SEASONAL_REVISIT_DAYS = 120; // ~4 months, for journey-length plans

interface ScheduleParams {
  userId: mongoose.Types.ObjectId | string;
  dependentId?: mongoose.Types.ObjectId | string | null | undefined;
  source: PlanCheckInSource;
  sourceId?: mongoose.Types.ObjectId | string | null | undefined;
  sport: string;
  title: string;
  signals: string[];
  checkInDueAt: Date;
}

export class PlanCheckInService {
  /** Creates the PlanCheckIn record and the scheduled email/in-app nudge that fires on its due date. */
  static async schedule(params: ScheduleParams): Promise<PlanCheckInDocument> {
    const checkIn = await PlanCheckIn.create({
      userId: params.userId,
      source: params.source,
      sport: params.sport,
      title: params.title,
      signals: params.signals,
      checkInDueAt: params.checkInDueAt,
      status: "active",
      ...(params.dependentId ? { dependentId: params.dependentId } : {}),
      ...(params.sourceId ? { sourceId: params.sourceId } : {}),
    });

    await ScheduledNotification.create({
      userId: params.userId,
      type: "PLAN_CHECKIN",
      interval: "CUSTOM",
      scheduledFor: params.checkInDueAt,
      status: "PENDING",
      title: `How's ${params.sport} going?`,
      body: params.title,
      data: {
        checkInId: checkIn._id.toString(),
        sport: params.sport,
        signals: params.signals,
      },
      channels: { email: true, inApp: true },
    });

    return checkIn;
  }

  /**
   * Repoints an existing find-sport trial check-in at a different sport.
   *
   * The trial check-in is scheduled the moment results are saved, off the sport
   * we scored highest — before the parent has had a chance to say what they're
   * actually starting with. When they do pick, the already-scheduled nudge (and
   * the email it will send four weeks from now) has to follow, or we'd be
   * asking how the trial went for a sport they never tried.
   *
   * Returns null when there's nothing to retarget, so the caller can schedule
   * a fresh check-in instead.
   */
  static async retargetFindSportTrial(params: {
    userId: mongoose.Types.ObjectId | string;
    dependentId?: mongoose.Types.ObjectId | string | null | undefined;
    sport: string;
    title: string;
    signals: string[];
  }): Promise<PlanCheckInDocument | null> {
    const checkIn = await PlanCheckIn.findOne({
      userId: params.userId,
      source: "find_sport_trial",
      status: { $in: ["active", "due"] },
      ...(params.dependentId ? { dependentId: params.dependentId } : {}),
    }).sort({ createdAt: -1 });

    if (!checkIn) return null;
    if (checkIn.sport === params.sport) return checkIn;

    checkIn.sport = params.sport;
    checkIn.title = params.title;
    checkIn.signals = params.signals;
    await checkIn.save();

    // The queued email carries its own copy of the sport — updating only the
    // check-in would leave the nudge naming the old one.
    await ScheduledNotification.updateMany(
      {
        userId: params.userId,
        type: "PLAN_CHECKIN",
        status: "PENDING",
        "data.checkInId": checkIn._id.toString(),
      },
      {
        $set: {
          title: `How's ${params.sport} going?`,
          body: params.title,
          "data.sport": params.sport,
          "data.signals": params.signals,
        },
      }
    );

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
      const weeks = response.shortTermPlan.durationWeeks || response.shortTermPlan.weeks.length;
      await this.schedule({
        userId: params.userId,
        dependentId: params.dependentId,
        source: "guidance_short_plan",
        sourceId: params.sourceId,
        sport: params.sport,
        title: `It's been ${weeks} week${weeks === 1 ? "" : "s"} since your ${params.sport} plan — here's how to check if it worked.`,
        signals: [response.shortTermPlan.successCheck].filter(Boolean),
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
        signals: [response.goalAssessment?.statedGoal || "Overall progress toward the goal"].filter(
          Boolean
        ),
        checkInDueAt: new Date(Date.now() + SEASONAL_REVISIT_DAYS * 24 * 60 * 60 * 1000),
      });
    }
  }

  /** What the client should do next, given the source and the parent's answer. */
  static computeFollowUp(
    checkIn: PlanCheckInDocument
  ):
    | { kind: "done"; message: string }
    | { kind: "try_next_sport"; message: string }
    | { kind: "re_diagnose"; message: string }
    | { kind: "escalate"; message: string; whatsappUrl: string | null } {
    const isFindSport = checkIn.source === "find_sport_trial";

    if (checkIn.status === "progressing") {
      return isFindSport
        ? { kind: "done", message: "That's great to hear — keep going." }
        : { kind: "done", message: "Great progress. Come back anytime for the next step." };
    }

    if (checkIn.status === "abandoned") {
      return { kind: "done", message: "No problem — thanks for letting us know." };
    }

    if (isFindSport) {
      // Lower-stakes loop — no human escalation needed, just point at the
      // other two portfolio picks from the same assessment.
      return {
        kind: "try_next_sport",
        message: "Worth trying one of the other two sports we suggested instead?",
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
      whatsappUrl: checkIn.sourceId ? `/api/guidance/${checkIn.sourceId}/whatsapp` : null,
    };
  }
}

export type { PlanCheckInStatus };
