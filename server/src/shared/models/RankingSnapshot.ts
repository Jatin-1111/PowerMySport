import mongoose, { Document, Schema } from "mongoose";

/**
 * One published ranking list — a single (category, subcategory, as-on date)
 * from a federation, plus the provenance and health of the run that ingested
 * it. The player rows themselves live in RankingEntry.
 *
 * `contentHash` is what makes the pipeline idempotent: AITA re-uploads a
 * corrected PDF under the *same* as-on date often enough that date alone is not
 * an identity. A new hash for a date we already hold is a correction, so it
 * lands as a new snapshot with `version` bumped and the previous one demoted,
 * rather than overwriting rows in place and losing what was published before.
 *
 * `sportSlug`/`federationCode` are fixed to tennis/AITA today. They exist so a
 * second federation does not require a migration, not because anything reads
 * them yet.
 */
export type RankingSnapshotStatus =
  "discovered" | "archived" | "parsed" | "published" | "quarantined" | "failed";

export interface RankingSnapshotDocument extends Document {
  sportSlug: string;
  federationCode: string;
  category: string;
  subcategory: string;
  /** The Monday the ranking is "as on" — not the day AITA uploaded it. */
  asOnDate: Date;

  pdfUrl: string;
  /** The result page the PDF link was read from, shown publicly as provenance. */
  sourceUrl: string;
  /** sha256 of the PDF bytes. Identity for corrections. */
  contentHash: string;
  /** Key in the documents bucket. Internal — the PDF is never served publicly. */
  s3Key?: string;
  byteSize?: number;
  /** Server-reported validators, so a re-upload can be spotted without a full GET. */
  sourceEtag?: string;
  sourceLastModified?: string;

  status: RankingSnapshotStatus;
  /** 1 for the first ingest of this as-on date, 2+ for each later correction. */
  version: number;
  /** The newest published version for this combo. Drives the default query. */
  isLatestForCombo: boolean;

  pageCount?: number;
  rowCount?: number;
  /** Header labels in column order, as printed. Differs between categories. */
  columns?: string[];
  diagnostics?: {
    malformedRows: number;
    missingDob: number;
    unknownStateCodes: string[];
    unknownStateRows: number;
    unparsedLines: string[];
    warnings: string[];
  };
  /** Why a run stopped, when status is `quarantined` or `failed`. */
  failureReason?: string;

  // ── Derived analytics ──────────────────────────────────────────────────────
  // Computed once at publish time from the rows of this list; see
  // `services/aita/rankingInsights.ts`. Stored on the snapshot rather than
  // aggregated per request because every public read wants them and the
  // collection runs to hundreds of thousands of rows on a shared-tier cluster.
  //
  /** The as-on date the rows' `prevRank` was measured against. */
  comparedTo?: Date;
  /** Points needed to sit inside the top 1/10/25/50/100/250/500/1000. */
  benchmarks?: Array<{ rank: number; points: number }>;
  /** Ranked players per state, and each state's share of the national top 100. */
  stateCounts?: Array<{ state: string; count: number; inTop100: number }>;
  /** Average points by source for the top 10 / 11–100 / 101 and below. */
  bandProfiles?: Array<{
    label: string;
    from: number;
    to: number | null;
    playerCount: number;
    averageTotal: number;
    composition: Array<{
      label: string;
      average: number;
      isDeduction: boolean;
      /** Printed on the sheet but not scored — the raw doubles column. */
      isInformational?: boolean;
    }>;
  }>;

  fetchedAt?: Date;
  parsedAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Declared separately rather than inline: mongoose's typed `Schema<T>` generic
 * tries to match a nested `new Schema(...)` against the plain object type on
 * the interface and rejects every path in it.
 */
const diagnosticsSchema = new Schema(
  {
    malformedRows: { type: Number, default: 0 },
    missingDob: { type: Number, default: 0 },
    unknownStateCodes: { type: [String], default: [] },
    unknownStateRows: { type: Number, default: 0 },
    unparsedLines: { type: [String], default: [] },
    warnings: { type: [String], default: [] },
  },
  { _id: false }
);

/** Same reason as `diagnosticsSchema` — nested schemas cannot be inlined here. */
const benchmarkSchema = new Schema(
  {
    rank: { type: Number, required: true },
    points: { type: Number, required: true },
  },
  { _id: false }
);

const stateCountSchema = new Schema(
  {
    state: { type: String, required: true },
    count: { type: Number, required: true },
    inTop100: { type: Number, default: 0 },
  },
  { _id: false }
);

const bandProfileSchema = new Schema(
  {
    label: { type: String, required: true },
    from: { type: Number, required: true },
    // `null` is the open-ended tail band, so the field is nullable rather than
    // absent — `default: null` keeps "unbounded" from reading as "not computed".
    to: { type: Number, default: null },
    playerCount: { type: Number, required: true },
    averageTotal: { type: Number, default: 0 },
    composition: {
      type: [
        {
          _id: false,
          label: { type: String, required: true },
          average: { type: Number, default: 0 },
          isDeduction: { type: Boolean, default: false },
          isInformational: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    // Present only on snapshots whose composition came from a sample of the
    // band rather than all of it. Absent means the whole band was measured,
    // which is true of every snapshot archived before the August 2026 cutover.
    sampleSize: { type: Number },
    // What the composition slices sum to. Differs from `averageTotal`, which is
    // exact over the whole band — see the note on `BandProfile`.
    compositionTotal: { type: Number },
  },
  { _id: false }
);

const rankingSnapshotSchema = new Schema<RankingSnapshotDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, default: "tennis", index: true },
    federationCode: { type: String, required: true, uppercase: true, default: "AITA" },
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, required: true, trim: true },
    asOnDate: { type: Date, required: true },

    pdfUrl: { type: String, required: true },
    sourceUrl: { type: String, required: true },
    contentHash: { type: String, required: true },
    s3Key: { type: String },
    byteSize: { type: Number },
    sourceEtag: { type: String },
    sourceLastModified: { type: String },

    status: {
      type: String,
      enum: ["discovered", "archived", "parsed", "published", "quarantined", "failed"],
      default: "discovered",
      index: true,
    },
    version: { type: Number, default: 1 },
    isLatestForCombo: { type: Boolean, default: false },

    pageCount: { type: Number },
    rowCount: { type: Number },
    columns: { type: [String], default: undefined },
    diagnostics: { type: diagnosticsSchema, default: undefined },
    failureReason: { type: String },

    comparedTo: { type: Date },
    benchmarks: { type: [benchmarkSchema], default: undefined },
    stateCounts: { type: [stateCountSchema], default: undefined },
    bandProfiles: { type: [bandProfileSchema], default: undefined },

    fetchedAt: { type: Date },
    parsedAt: { type: Date },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

// Identity. Two rows for the same date are allowed only when the bytes differ,
// which is exactly the corrected-re-upload case.
rankingSnapshotSchema.index(
  { federationCode: 1, category: 1, subcategory: 1, asOnDate: 1, contentHash: 1 },
  { unique: true }
);
// "What is the newest list for this combo?" — the query behind every public page.
rankingSnapshotSchema.index({ category: 1, subcategory: 1, isLatestForCombo: 1 });
// Staleness monitoring and the admin health view.
rankingSnapshotSchema.index({ status: 1, asOnDate: -1 });

export const RankingSnapshot =
  mongoose.models.RankingSnapshot ||
  mongoose.model<RankingSnapshotDocument>("RankingSnapshot", rankingSnapshotSchema);
