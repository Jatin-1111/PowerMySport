import mongoose from "mongoose";
import { TournamentEdition } from "../../shared/models/TournamentEdition";
import { AppError } from "../../utils/AppError";
import { Player } from "../models/Player";
import {
  MAX_NOTE_LENGTH,
  MAX_PLAN_ENTRIES,
  SeasonPlan,
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
    return {
      dependentId,
      sportSlug: plan?.sportSlug ?? "tennis",
      entries: (plan?.entries ?? []).slice().sort(byDate),
    };
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
      return {
        dependentId: params.dependentId,
        sportSlug: plan.sportSlug,
        entries: plan.entries.slice().sort(byDate),
      };
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

    return {
      dependentId: params.dependentId,
      sportSlug: plan.sportSlug,
      entries: plan.entries.slice().sort(byDate),
    };
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
    return {
      dependentId: params.dependentId,
      sportSlug: plan.sportSlug,
      entries: plan.entries.slice().sort(byDate),
    };
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
    return { dependentId, sportSlug: plan.sportSlug, entries: plan.entries.slice().sort(byDate) };
  },

  /** Cascade for profile deletion — see `AuthService/dependents.ts`. */
  async removeForDependent(dependentId: string): Promise<void> {
    await SeasonPlan.deleteMany({ dependentId });
  },
};
