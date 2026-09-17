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

export interface SeasonPlanEntry {
  /** Identity on the calendar. Stable, and present on every edition. */
  editionSlug: string;
  /** What was planned, as it read when it was planned. See the note above. */
  name: string;
  startDate: Date;
  status: SeasonPlanEntryStatus;
  /** The parent's own words. Short on purpose; this is not a journal. */
  note?: string;
  addedAt: Date;
}

export interface SeasonPlanDocument extends Document {
  userId: Types.ObjectId;
  /** The child this plan belongs to. */
  dependentId: Types.ObjectId;
  sportSlug: string;
  entries: SeasonPlanEntry[];
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
    addedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const seasonPlanSchema = new Schema<SeasonPlanDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dependentId: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    sportSlug: { type: String, required: true, lowercase: true, trim: true, default: "tennis" },
    entries: { type: [seasonPlanEntrySchema], default: [] },
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
