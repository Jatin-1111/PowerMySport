import mongoose, { Document, Schema, Types } from "mongoose";

/**
 * One player's row in one ranking list.
 *
 * ── Why `dob` is `select: false` ──────────────────────────────────────────────
 * These lists carry the full name, exact date of birth, registration number and
 * home state of children — the youngest are twelve. AITA publishing that as a
 * PDF behind three dropdowns is not the same act as us republishing it as a
 * searchable, filterable, indexable database, and under the DPDP Act 2023
 * children's data carries obligations that a "but it was already public"
 * argument does not discharge.
 *
 * So the date of birth is stored (age-category validation and cohort analysis
 * both need it, and with regNo it is the strongest identity signal we have) but
 * `select: false` keeps it out of every query that does not name it explicitly.
 * That is deliberately a schema-level guarantee rather than a convention in the
 * controllers: a new endpoint written a year from now is safe by default, and
 * exposing it has to be a decision someone typed out.
 *
 * `birthYear` is the public-safe derivative and is what the API returns.
 *
 * ── Denormalisation ──────────────────────────────────────────────────────────
 * category/subcategory/asOnDate/isLatest are copied from the snapshot. Every
 * public query filters on them, and the join to fetch them per row is not worth
 * paying on a collection this size (~12k rows per weekly sweep across the
 * twelve live combos; a full 251-snapshot backfill is around 3M rows).
 */
export interface RankingEntryDocument extends Document {
  snapshot: Types.ObjectId;
  sportSlug: string;
  federationCode: string;
  category: string;
  subcategory: string;
  asOnDate: Date;
  /** Mirrors the snapshot's `isLatestForCombo`, so list queries hit one index. */
  isLatest: boolean;

  /** As printed. Ties are common — this is not unique within a list. */
  rank: number;
  regNo: string;
  givenName: string;
  familyName: string;
  fullName: string;
  /** Lowercased `fullName`, for anchored prefix search against an index. */
  nameSearch: string;

  /** INTERNAL ONLY — see the note above. Never returned by a public endpoint. */
  dob?: Date;
  /** The public-safe derivative of `dob`. */
  birthYear?: number;

  stateCode?: string;
  /** Canonical name from `shared/utils/states.ts`, never the raw code. */
  state?: string;

  /** Label -> value straight off the PDF header; the set differs by category. */
  points: Array<{ label: string; value: number }>;
  totalPoints: number;

  /**
   * Rank in the immediately preceding published list for this combo. Absent
   * means new to this list — either a first-ever ranking or a player who has
   * just aged up into it. `RankingSnapshot.comparedTo` records which date this
   * was measured against, so "no baseline at all" (the oldest list we hold)
   * stays distinguishable from "new entry".
   *
   * Stored rather than joined: the movement arrow appears on every row of every
   * list, and computing it per request means a second full-list read plus a
   * merge on a shared-tier cluster.
   */
  prevRank?: number;
  /**
   * Rank within the player's own state in this same list — the fact the source
   * PDF cannot answer. Absent when the state code did not map.
   */
  stateRank?: number;

  /**
   * AITA's own base64 player id on the new platform, e.g. `UklBTkFONDQwMDkw`.
   *
   * The join key for their profile and point-breakdown endpoints, and the thing
   * `regNo` is decoded out of. Absent on rows archived before the cutover.
   */
  playerKey?: string;
  /**
   * AITA zone: 1 = North, 2 = South, 3 = East, 4 = West.
   *
   * Not decoration — Talent Series entry is restricted to players registered in
   * the host zone, so this is the eligibility boundary the pathway pages have
   * been describing from a 2020 document.
   */
  zoneId?: number;
  /**
   * Tournaments counted toward this ranking. Read zero on every row across all
   * twelve lists at cutover, so treat a zero as "not published yet" rather than
   * as a claim that the player did not compete.
   */
  tournamentsPlayed?: number;
  /**
   * World Tennis Number — an internationally comparable rating, unlike AITA
   * points. Rendered on every row but empty on all 11,030 of them at cutover.
   */
  wtnSingles?: number;
  wtnDoubles?: number;
  /**
   * True when `points` holds this player's real component breakdown rather than
   * the total alone.
   *
   * The new platform prints only a total on the list page, so the breakdown is
   * fetched for a bounded sample of each band — see
   * `services/aita/sampleBandComposition.ts`. Rows archived before the cutover
   * have full columns and no flag, which `computeBandProfiles` still handles.
   */
  pointsSampled?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const rankingEntrySchema = new Schema<RankingEntryDocument>(
  {
    snapshot: {
      type: Schema.Types.ObjectId,
      ref: "RankingSnapshot",
      required: true,
      index: true,
    },
    sportSlug: { type: String, required: true, lowercase: true, default: "tennis" },
    federationCode: { type: String, required: true, uppercase: true, default: "AITA" },
    category: { type: String, required: true },
    subcategory: { type: String, required: true },
    asOnDate: { type: Date, required: true },
    isLatest: { type: Boolean, default: false },

    rank: { type: Number, required: true },
    regNo: { type: String, required: true, trim: true },
    givenName: { type: String, default: "", trim: true },
    familyName: { type: String, default: "", trim: true },
    fullName: { type: String, required: true, trim: true },
    nameSearch: { type: String, required: true, lowercase: true, trim: true },

    // The one field the rest of the codebase must opt into by name.
    dob: { type: Date, select: false },
    birthYear: { type: Number },

    stateCode: { type: String, uppercase: true, trim: true },
    state: { type: String, trim: true },

    points: {
      type: [
        {
          _id: false,
          label: { type: String, required: true },
          value: { type: Number, required: true },
        },
      ],
      default: [],
    },
    totalPoints: { type: Number, default: 0 },

    prevRank: { type: Number },
    stateRank: { type: Number },

    // ── Added with the August 2026 platform cutover ─────────────────────────
    // All optional, because 468k archived rows predate them. Mongoose runs
    // strict mode by default, so a field absent from here is dropped on write
    // without an error — which is why these arrived with the ingest change
    // rather than after it.
    playerKey: { type: String, trim: true },
    zoneId: { type: Number },
    tournamentsPlayed: { type: Number },
    wtnSingles: { type: Number },
    wtnDoubles: { type: Number },
    pointsSampled: { type: Boolean },
  },
  { timestamps: true }
);

// One row per player per snapshot. Re-running a parse updates in place.
rankingEntrySchema.index({ snapshot: 1, regNo: 1 }, { unique: true });
// The main list page: current ranking for a combo, optionally by state.
rankingEntrySchema.index({ category: 1, subcategory: 1, isLatest: 1, rank: 1 });
rankingEntrySchema.index({ state: 1, category: 1, subcategory: 1, isLatest: 1, rank: 1 });
// A player's trajectory across snapshots — the thing the PDFs cannot answer.
rankingEntrySchema.index({ regNo: 1, category: 1, subcategory: 1, asOnDate: -1 });
// Name search, anchored so the index is usable.
rankingEntrySchema.index({ nameSearch: 1 });

export const RankingEntry =
  mongoose.models.RankingEntry ||
  mongoose.model<RankingEntryDocument>("RankingEntry", rankingEntrySchema);
