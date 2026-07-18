import { Request, Response } from "express";
import mongoose from "mongoose";
import { PlanCheckIn } from "../../shared/models/PlanCheckIn";
import { PlanCheckInService } from "../../shared/services/PlanCheckInService";
import { Player } from "../models/Player";

const TRIAL_WEEKS = 4;

/**
 * POST /plan-checkins/find-sport-trial
 * Created client-side right after a /find-sport recommendation is saved to
 * a dependent — there's no server-side generation step to hook into (the
 * scorer runs in the browser), so this is the one check-in type the client
 * initiates directly rather than the server creating it as a side effect.
 */
export const createFindSportTrialCheckIn = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { dependentId, sport, signals } = req.body;
    if (!sport || typeof sport !== "string" || !sport.trim()) {
      res.status(400).json({ success: false, message: "sport is required" });
      return;
    }

    let validDependentId: string | null = null;
    if (dependentId && mongoose.isValidObjectId(dependentId)) {
      const dep = await Player.findOne({ _id: dependentId, userId: req.user.id }).lean();
      if (dep) validDependentId = dependentId;
    }

    const cleanSignals = Array.isArray(signals)
      ? signals.filter((s) => typeof s === "string").slice(0, 4).map((s) => s.slice(0, 300))
      : [];

    const checkInDueAt = new Date(Date.now() + TRIAL_WEEKS * 7 * 24 * 60 * 60 * 1000);
    const sportName = sport.trim().slice(0, 60);

    const checkIn = await PlanCheckInService.schedule({
      userId: req.user.id,
      dependentId: validDependentId,
      source: "find_sport_trial",
      sport: sportName,
      title: `We recommended ${sportName} about ${TRIAL_WEEKS} weeks ago — how did the trial go?`,
      signals: cleanSignals,
      checkInDueAt,
    });

    res.status(201).json({ success: true, data: checkIn });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to schedule trial check-in" });
  }
};

/**
 * GET /plan-checkins/:id
 * Fetch a single check-in — this is what the emailed link lands on.
 */
export const getPlanCheckIn = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid check-in id" });
      return;
    }

    const checkIn = await PlanCheckIn.findById(id).lean();
    if (!checkIn) {
      res.status(404).json({ success: false, message: "Check-in not found" });
      return;
    }
    if (checkIn.userId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    res.status(200).json({ success: true, data: checkIn });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch check-in" });
  }
};

/**
 * GET /plan-checkins
 * Active/due check-ins for the logged-in parent (e.g. an "active plans" list).
 */
export const listPlanCheckIns = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const checkIns = await PlanCheckIn.find({
      userId: req.user.id,
      status: { $in: ["active", "due"] },
    })
      .sort({ checkInDueAt: 1 })
      .lean();

    res.status(200).json({ success: true, data: checkIns });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch check-ins" });
  }
};

const RESPOND_STATUSES = ["progressing", "not_progressing", "ambiguous", "abandoned"];

/**
 * POST /plan-checkins/:id/respond
 * The parent's answer to "how's it going?" — returns what the client should
 * offer next (re-diagnose, escalate to the team, try another sport, or done).
 */
export const respondToPlanCheckIn = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { id } = req.params;
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid check-in id" });
      return;
    }

    const { status, outcomeNote } = req.body;
    if (!RESPOND_STATUSES.includes(status)) {
      res.status(400).json({
        success: false,
        message: `status must be one of: ${RESPOND_STATUSES.join(", ")}`,
      });
      return;
    }

    const checkIn = await PlanCheckIn.findById(id);
    if (!checkIn) {
      res.status(404).json({ success: false, message: "Check-in not found" });
      return;
    }
    if (checkIn.userId.toString() !== req.user.id) {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    checkIn.status = status;
    if (typeof outcomeNote === "string") {
      checkIn.outcomeNote = outcomeNote.slice(0, 2000);
    }
    checkIn.respondedAt = new Date();
    await checkIn.save();

    const followUp = PlanCheckInService.computeFollowUp(checkIn);

    res.status(200).json({ success: true, data: { checkIn, followUp } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to record response" });
  }
};
