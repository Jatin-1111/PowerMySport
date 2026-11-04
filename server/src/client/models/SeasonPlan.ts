import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * The tournaments a parent has decided their child will play.
 *
 * ── One document per child, not one per entry ───────────────────────────────
 * A plan is read and written whole — a parent opens their child's list, adds
 * one, marks one played — so there is no query that wants entries separately.
 * Storing them as an array costs one document and one index where a per-entry
 * collection would cost hundreds of documents and at least two.
 *
 * That is a deliberate response to a measured constraint rather than a
 * preference: the cluster sits at 492MB of its 512MB cap, it blocked writes
 * platform-wide on 2026-09-17, and the meter counts logical size, so documents
 * and index entries both count against it directly. A plan is the smallest
 * thing in this database and it should stay that way.
 *
 * The array is capped for the same reason, and because a list of fifty
 * tournaments is not a plan. The federation publishes about ten weeks ahead,
 * so a realistic plan holds a handful.
 *
 * ── Why each entry carries a name and a date ────────────────────────────────
 * Everywhere else in this codebase the rule is to store identity and join the
 * rest live, because a copy goes stale — `PlayerRankingLink` holds a
 * registration number and nothing else. This is the exception, and the reason
 * is that a plan is a *record of a decision*, not a view of current data.
 *
 * An edition can be merged into a duplicate, pruned, or corrected out from
 * under a plan that references it. When that happens the live join returns
 * nothing, and a parent's record of the tournament their child actually played
 * would disappear with it. The snapshot is what they decided, on the day they
 * decided it; the slug is how it is matched back to the calendar while the
 * calendar still holds it.
 */
export type SeasonPlanEntryStatus = "shortlisted" | "entered" | "played";

/**
 * What a parent says an event costs, in whole rupees. Each is optional and each
 * replaces the planner's estimate for that part when present. Entry fees are only
 * ever stored here: the calendar does not publish them and we do not guess.
 */
export interface EntryCosts {
  travel?: number;
  stay?: number;
  entryFee?: number;
}

/** A ceiling that stops a typo (an extra zero) from becoming a budget. */
export const MAX_COST_INR = 1_000_000;
export const MAX_BUDGET_INR = 10_000_000;

export interface SeasonPlanEntry {
  /** Identity on the calendar. Stable, and present on every edition. */
  editionSlug: string;
  /** What was planned, as it read when it was planned. See the note above. */
  name: string;
  startDate: Date;
  status: SeasonPlanEntryStatus;
  /** The parent's own words. Short on purpose; this is not a journal. */
  note?: string;
  /** The parent's own figures, where they have given any. */
  costs?: EntryCosts;
  addedAt: Date;
}

/**
 * What the parent wants the season to be for. Chosen from a short list rather
 * than typed, because the recommender is built to serve exactly these.
 *
 *   points      climb the ranking: favour the higher rungs of the circuit
 *   experience  play often: favour events where entry is by registration
 *   home        stay close: favour events in the child's own state
 */
export type SeasonGoal = "points" | "experience" | "home";
export const SEASON_GOALS: readonly SeasonGoal[] = ["points", "experience", "home"];
export const DEFAULT_SEASON_GOAL: SeasonGoal = "points";

/** Dates the child cannot play, such as exams. Whole calendar days, inclusive. */
export interface BlockedRange {
  from: Date;
  to: Date;
  /** Short and optional: "Board exams". Shown back to the parent only. */
  label?: string;
}

export interface SeasonPlanPreferences {
  goal: SeasonGoal;
  blockedRanges: BlockedRange[];
  /** What they want the season to stay within, in rupees. Absent means no ceiling. */
  budget?: number;
  /**
   * Also offer events in an older age group, as options and never as picks. Playing up
   * spends the same yearly allowance and is a decision for a parent, so it is off until
   * they ask for it.
   */
  includeOlderGroup?: boolean;
}

/** Events a parent has said are not for them. A season does not need more than this. */
export const MAX_DISMISSED = 60;

/** Five ranges is a season's worth of exams and holidays; more is a calendar. */
export const MAX_BLOCKED_RANGES = 5;
export const MAX_BLOCKED_LABEL_LENGTH = 40;

export interface SeasonPlanDocument extends Document {
  userId: Types.ObjectId;
  /** The child this plan belongs to. */
  dependentId: Types.ObjectId;
  sportSlug: string;
  entries: SeasonPlanEntry[];
  /**
   * Stored on the plan, not beside it. Preferences are tiny and read with the
   * plan every time, and the cluster is at its size cap, so a second collection
   * (with its own index) would cost more than the data it holds.
   */
  preferences?: SeasonPlanPreferences;
  /**
   * Slugs of suggested events the parent marked "not for us". They are left out of every
   * later suggestion. Short slugs on the plan, for the same reason as the preferences: no
   * second collection for something this small.
   */
  dismissed?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/** A plan longer than this is a calendar, not a plan. */
export const MAX_PLAN_ENTRIES = 50;
export const MAX_NOTE_LENGTH = 280;

const seasonPlanEntrySchema = new Schema<SeasonPlanEntry>(
  {
    editionSlug: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["shortlisted", "entered", "played"],
      required: true,
      default: "shortlisted",
    },
    note: { type: String, trim: true, maxlength: MAX_NOTE_LENGTH },
    costs: {
      type: new Schema<EntryCosts>(
        {
          travel: { type: Number, min: 0, max: MAX_COST_INR },
          stay: { type: Number, min: 0, max: MAX_COST_INR },
          entryFee: { type: Number, min: 0, max: MAX_COST_INR },
        },
        { _id: false }
      ),
    },
    addedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const blockedRangeSchema = new Schema<BlockedRange>(
  {
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    label: { type: String, trim: true, maxlength: MAX_BLOCKED_LABEL_LENGTH },
  },
  { _id: false }
);

const preferencesSchema = new Schema<SeasonPlanPreferences>(
  {
    goal: { type: String, enum: SEASON_GOALS, default: DEFAULT_SEASON_GOAL },
    blockedRanges: { type: [blockedRangeSchema], default: [] },
    budget: { type: Number, min: 0, max: MAX_BUDGET_INR },
    includeOlderGroup: { type: Boolean, default: false },
  },
  { _id: false }
);

const seasonPlanSchema = new Schema<SeasonPlanDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dependentId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    sportSlug: { type: String, required: true, lowercase: true, trim: true, default: "tennis" },
    entries: { type: [seasonPlanEntrySchema], default: [] },
    preferences: { type: preferencesSchema },
    dismissed: {
      type: [{ type: String, lowercase: true, trim: true, maxlength: 200 }],
      default: [],
    },
  },
  { timestamps: true }
);

/**
 * The only index, and it earns its place twice.
 *
 * `{userId, dependentId}` unique enforces one plan per child, and its `userId`
 * prefix serves "every plan I own" without a second index. Nothing queries by
 * edition slug: finding who planned a given tournament is not a question this
 * product asks, and adding the index for it would spend quota on a report
 * nobody has requested.
 */
seasonPlanSchema.index({ userId: 1, dependentId: 1 }, { unique: true });

// Production runs with autoIndex off, so it also ships as migration 46.

export const SeasonPlan = mongoose.model<SeasonPlanDocument>("SeasonPlan", seasonPlanSchema);
