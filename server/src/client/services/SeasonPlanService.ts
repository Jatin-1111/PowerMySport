import mongoose from "mongoose";
import { TournamentEdition } from "../../shared/models/TournamentEdition";
import { AppError } from "../../utils/AppError";
import { Player } from "../models/Player";
import {
  DEFAULT_SEASON_GOAL,
  MAX_BLOCKED_LABEL_LENGTH,
  MAX_BLOCKED_RANGES,
  MAX_NOTE_LENGTH,
  MAX_PLAN_ENTRIES,
  SEASON_GOALS,
  SeasonPlan,
  type BlockedRange,
  type SeasonGoal,
  type SeasonPlanEntry,
  type SeasonPlanEntryStatus,
} from "../models/SeasonPlan";

/**
 * Adding, moving and removing tournaments on a child's plan.
 *
 * ── What this refuses to take on trust ──────────────────────────────────────
 * The slug arrives from a browser, so an entry is only created from an edition
 * that exists, on the sport the plan is for. The name and date are then read
 * from that edition rather than from the request: a client that posted its own
 * title would let the plan say a tournament was something it was not, and the
 * one thing a record of a decision has to be is accurate about what was
 * decided.
 *
 * ── Why there is no eligibility check here ──────────────────────────────────
 * The planner decides what a child *can* enter; this stores what a parent *has
 * decided*. Those are different questions, and conflating them would mean a
 * rank change silently deleting a plan, or a parent being unable to record a
 * tournament their child actually played because our copy of the rules
 * disagrees. The eligibility view is advice. The plan is theirs.
 */

const STATUSES: SeasonPlanEntryStatus[] = ["shortlisted", "entered", "played"];

/** Newest decisions last: a plan reads as a season, in the order it happens. */
const byDate = (a: SeasonPlanEntry, b: SeasonPlanEntry) =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

/** A blocked range as the API speaks it: plain calendar dates, no clock. */
export interface BlockedRangeView {
  from: string;
  to: string;
  label?: string;
}

export interface PlanPreferencesView {
  goal: SeasonGoal;
  blockedRanges: BlockedRangeView[];
}

const toDay = (date: Date): string => date.toISOString().slice(0, 10);

const presentPreferences = (
  preferences:
    { goal?: SeasonGoal | undefined; blockedRanges?: BlockedRange[] | undefined } | undefined
): PlanPreferencesView => ({
  goal: preferences?.goal ?? DEFAULT_SEASON_GOAL,
  blockedRanges: (preferences?.blockedRanges ?? []).map((range) => ({
    from: toDay(range.from),
    to: toDay(range.to),
    ...(range.label ? { label: range.label } : {}),
  })),
});

/**
 * Every response that returns a plan returns it in this one shape, preferences
 * included. The client writes each response straight into its cache, so a
 * mutation that left preferences out would silently wipe them from the page.
 */
const presentPlan = (
  dependentId: string,
  plan: {
    sportSlug?: string | undefined;
    entries?: SeasonPlanEntry[] | undefined;
    preferences?: Parameters<typeof presentPreferences>[0];
  } | null
) => ({
  dependentId,
  sportSlug: plan?.sportSlug ?? "tennis",
  entries: (plan?.entries ?? []).slice().sort(byDate),
  preferences: presentPreferences(plan?.preferences),
});

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDay = (value: unknown): Date | null => {
  if (typeof value !== "string" || !DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  // Round-trip to reject 2026-02-31, which `Date` would quietly roll forward.
  return Number.isNaN(date.getTime()) || toDay(date) !== value ? null : date;
};

const assertOwnedDependent = async (userId: string, dependentId: string) => {
  if (!mongoose.isValidObjectId(dependentId)) {
    throw new AppError("Choose which player this plan is for.", 400);
  }
  const dependent = await Player.findOne({ _id: dependentId, userId }).select("_id").lean();
  if (!dependent) {
    throw new AppError("Player profile not found.", 404);
  }
};

export const SeasonPlanService = {
  /** One child's plan. An absent plan reads as an empty one, never a 404. */
  async get(userId: string, dependentId: string) {
    await assertOwnedDependent(userId, dependentId);
    const plan = await SeasonPlan.findOne({ userId, dependentId }).lean();
    return presentPlan(dependentId, plan);
  },

  /**
   * Add a tournament, or return the plan unchanged if it is already on it.
   *
   * Idempotent rather than erroring: the button that calls this sits next to a
   * list the parent may have open in two tabs, and "you already planned this"
   * is not information anyone needs.
   */
  async addEntry(params: {
    userId: string;
    dependentId: string;
    editionSlug: string;
    note?: string | undefined;
  }) {
    await assertOwnedDependent(params.userId, params.dependentId);

    const slug = String(params.editionSlug ?? "")
      .trim()
      .toLowerCase();
    if (!slug) throw new AppError("A tournament is required.", 400);

    const edition = await TournamentEdition.findOne({ slug })
      .select("name startDate sportSlug mergedInto")
      .lean();
    if (!edition) {
      throw new AppError("That tournament is not on the calendar.", 404);
    }
    // A merged row exists only to redirect; planning it would pin the record to
    // a duplicate that the public page bounces away from.
    if (edition.mergedInto) {
      throw new AppError("That tournament has moved. Open it again and add it from there.", 409);
    }

    const plan =
      (await SeasonPlan.findOne({ userId: params.userId, dependentId: params.dependentId })) ??
      new SeasonPlan({
        userId: params.userId,
        dependentId: params.dependentId,
        sportSlug: edition.sportSlug,
      });

    if (plan.entries.some((entry) => entry.editionSlug === slug)) {
      return presentPlan(params.dependentId, plan);
    }
    if (plan.entries.length >= MAX_PLAN_ENTRIES) {
      throw new AppError(
        `A plan holds up to ${MAX_PLAN_ENTRIES} tournaments. Remove one before adding another.`,
        400
      );
    }
    // A plan spanning two sports would make "their season" mean nothing.
    if (plan.sportSlug !== edition.sportSlug) {
      throw new AppError("That tournament is in a different sport from this plan.", 400);
    }

    plan.entries.push({
      editionSlug: slug,
      name: edition.name,
      startDate: edition.startDate,
      status: "shortlisted",
      ...(params.note ? { note: params.note.slice(0, MAX_NOTE_LENGTH) } : {}),
      addedAt: new Date(),
    });
    await plan.save();

    return presentPlan(params.dependentId, plan);
  },

  /** Move an entry along: shortlisted, entered, played. Or edit its note. */
  async updateEntry(params: {
    userId: string;
    dependentId: string;
    editionSlug: string;
    status?: string | undefined;
    note?: string | undefined;
  }) {
    await assertOwnedDependent(params.userId, params.dependentId);

    const plan = await SeasonPlan.findOne({
      userId: params.userId,
      dependentId: params.dependentId,
    });
    const entry = plan?.entries.find(
      (candidate) => candidate.editionSlug === params.editionSlug.trim().toLowerCase()
    );
    if (!plan || !entry) {
      throw new AppError("That tournament is not on this plan.", 404);
    }

    if (params.status !== undefined) {
      if (!STATUSES.includes(params.status as SeasonPlanEntryStatus)) {
        throw new AppError(`Status must be one of ${STATUSES.join(", ")}.`, 400);
      }
      entry.status = params.status as SeasonPlanEntryStatus;
    }
    if (params.note !== undefined) {
      const note = params.note.trim().slice(0, MAX_NOTE_LENGTH);
      // `delete entry.note` does nothing useful here: entries are mongoose
      // subdocuments, so the property comes back from the schema on the next
      // read and the note a parent cleared reappears. Assigning undefined is
      // what actually unsets the path on save.
      entry.note = note || (undefined as unknown as string);
    }

    plan.markModified("entries");
    await plan.save();
    return presentPlan(params.dependentId, plan);
  },

  /** Take a tournament off the plan. */
  async removeEntry(userId: string, dependentId: string, editionSlug: string) {
    await assertOwnedDependent(userId, dependentId);

    const plan = await SeasonPlan.findOne({ userId, dependentId });
    if (!plan) throw new AppError("That tournament is not on this plan.", 404);

    const slug = editionSlug.trim().toLowerCase();
    const before = plan.entries.length;
    plan.entries = plan.entries.filter((entry) => entry.editionSlug !== slug);
    if (plan.entries.length === before) {
      throw new AppError("That tournament is not on this plan.", 404);
    }

    await plan.save();
    return presentPlan(dependentId, plan);
  },

  /**
   * Replace the plan's preferences: the goal and the dates the child cannot play.
   *
   * Validated as a whole and applied as a whole, because the form that sends it
   * is a whole: a half-valid list that saved its good rows would leave the page
   * showing a different list from the one stored.
   *
   * Creates the plan if there is none yet, since a parent may set preferences
   * before choosing a single event.
   */
  async setPreferences(params: {
    userId: string;
    dependentId: string;
    goal?: unknown;
    blockedRanges?: unknown;
  }) {
    await assertOwnedDependent(params.userId, params.dependentId);

    if (!SEASON_GOALS.includes(params.goal as SeasonGoal)) {
      throw new AppError(`Goal must be one of ${SEASON_GOALS.join(", ")}.`, 400);
    }
    const rawRanges = params.blockedRanges ?? [];
    if (!Array.isArray(rawRanges)) {
      throw new AppError("Blocked dates must be a list.", 400);
    }
    if (rawRanges.length > MAX_BLOCKED_RANGES) {
      throw new AppError(`Add up to ${MAX_BLOCKED_RANGES} blocked date ranges.`, 400);
    }

    const blockedRanges: BlockedRange[] = rawRanges.map((raw) => {
      const from = parseDay((raw as { from?: unknown })?.from);
      const to = parseDay((raw as { to?: unknown })?.to);
      if (!from || !to) throw new AppError("Blocked dates need a valid start and end date.", 400);
      if (to.getTime() < from.getTime()) {
        throw new AppError("A blocked range cannot end before it starts.", 400);
      }
      const label = String((raw as { label?: unknown })?.label ?? "")
        .trim()
        .slice(0, MAX_BLOCKED_LABEL_LENGTH);
      return { from, to, ...(label ? { label } : {}) };
    });
    blockedRanges.sort((a, b) => a.from.getTime() - b.from.getTime());

    const plan =
      (await SeasonPlan.findOne({ userId: params.userId, dependentId: params.dependentId })) ??
      new SeasonPlan({
        userId: params.userId,
        dependentId: params.dependentId,
        sportSlug: "tennis",
      });
    plan.preferences = { goal: params.goal as SeasonGoal, blockedRanges };
    await plan.save();
    return presentPlan(params.dependentId, plan);
  },

  /** Cascade for profile deletion — see `AuthService/dependents.ts`. */
  async removeForDependent(dependentId: string): Promise<void> {
    await SeasonPlan.deleteMany({ dependentId });
  },
};
