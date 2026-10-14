import mongoose, { Document, Schema } from "mongoose";

/**
 * An admin-submitted data source (a link or an uploaded PDF) awaiting AI
 * extraction and human review before its data is written into the live
 * Federation / Tournament / TournamentEdition collections. Replaces the old
 * Lane-A cron scraper — nothing here auto-publishes; `status` only reaches
 * APPROVED via an explicit admin action in dataSourceAdminController.
 */
export type DataSourceTargetType =
  | "FEDERATION"
  | "CURATED_TOURNAMENT"
  | "TOURNAMENT_CALENDAR"
  /**
   * An admission route or scholarship (see models/Opportunity.ts). Reviewed
   * and approved through its own routes (opportunitySourceAdminController.ts),
   * never through the generic data-source approve path.
   */
  | "OPPORTUNITY";

export type DataSourceKind = "PDF" | "LINK";

export type DataSourceStatus =
  "PENDING_EXTRACTION" | "EXTRACTION_FAILED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

export interface DataSourceSubmissionDocument extends Document {
  targetType: DataSourceTargetType;
  sportSlug: string;
  /** Which Federation doc this feeds — required for FEDERATION and CURATED_TOURNAMENT */
  federationSlug?: string;
  /** Which curated Tournament doc this feeds — required for CURATED_TOURNAMENT */
  tournamentSlug?: string;
  /** OPPORTUNITY only: the entry being updated. Absent = the source proposes a new one. */
  opportunitySlug?: string;
  /** OPPORTUNITY only: which page a new entry belongs on. */
  opportunityTrack?: "admission" | "scholarship";
  /** OPPORTUNITY only: what the document is, e.g. "DU admissions bulletin 2026-27" — the public citation's label. */
  sourceLabel?: string;

  sourceKind: DataSourceKind;
  /** LINK sources */
  sourceUrl?: string;
  /** PDF sources */
  s3Key?: string;
  fileName?: string;
  /**
   * PDF sources only — the official page the PDF was downloaded from, if any.
   * Used as the public-facing citation instead of a signed (and expiring) S3
   * URL — never write an S3 download URL into a user-facing sourceUrls field.
   */
  originUrl?: string;

  status: DataSourceStatus;
  /** Raw AI-extracted payload — shape depends on targetType, edited in place before approval */
  extractedData?: unknown;
  /** field name -> short quote/paraphrase from the source supporting that field (FEDERATION/CURATED_TOURNAMENT only) */
  citations?: Record<string, string>;
  /** OPPORTUNITY only: the quote and figure checks made at extraction. */
  citationChecks?: unknown;
  /** OPPORTUNITY only: read the documents the page links to as well. */
  followDocuments?: boolean;
  /**
   * OPPORTUNITY only: once read, write what it said straight into a new DRAFT entry
   * (opportunityAutoDraft.ts). `draftedSlug` is that entry, set when it was made.
   */
  autoDraft?: boolean;
  draftedSlug?: string;
  /**
   * OPPORTUNITY only: what the AI approver made of this reading and did about it
   * (opportunityAutoApprover.ts). Recorded for every reading, acted on or not.
   */
  autoApproval?: unknown;
  /** OPPORTUNITY only: every source read for this submission, when documents were followed. */
  documents?: unknown;
  fieldSources?: unknown;
  conflicts?: unknown;
  extractionError?: string;
  /** Non-fatal validation notes on a successful extraction (e.g. "149 of 151 entries were dropped: …") */
  extractionWarnings?: string[];
  extractionModel?: string;
  extractedAt?: Date;

  reviewNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  /** Absent when `autoDetected`: the weekly watch raised it, not a person. */
  submittedBy?: mongoose.Types.ObjectId;
  autoDetected?: boolean;
  detectedChange?: "documents" | "text" | "file";

  createdAt: Date;
  updatedAt: Date;
}

const dataSourceSubmissionSchema = new Schema<DataSourceSubmissionDocument>(
  {
    targetType: {
      type: String,
      enum: ["FEDERATION", "CURATED_TOURNAMENT", "TOURNAMENT_CALENDAR", "OPPORTUNITY"],
      required: true,
    },
    sportSlug: { type: String, required: true, lowercase: true, index: true },
    federationSlug: { type: String, lowercase: true, trim: true },
    tournamentSlug: { type: String, lowercase: true, trim: true },
    opportunitySlug: { type: String, lowercase: true, trim: true },
    opportunityTrack: { type: String, enum: ["admission", "scholarship"] },
    sourceLabel: { type: String, trim: true, maxlength: 160 },

    sourceKind: { type: String, enum: ["PDF", "LINK"], required: true },
    sourceUrl: { type: String },
    s3Key: { type: String },
    fileName: { type: String },
    originUrl: { type: String },

    status: {
      type: String,
      enum: ["PENDING_EXTRACTION", "EXTRACTION_FAILED", "PENDING_REVIEW", "APPROVED", "REJECTED"],
      default: "PENDING_EXTRACTION",
      index: true,
    },
    extractedData: { type: Schema.Types.Mixed },
    citations: { type: Schema.Types.Mixed },
    // OPPORTUNITY only: whether each quote is on the page and each figure is in
    // its quote (dataSourceExtraction/quoteCheck.ts). Advice for the reviewer.
    citationChecks: { type: Schema.Types.Mixed },
    // OPPORTUNITY only: also read the PDFs a page links to (extraction/multiDocument.ts),
    // and what came of it. `documents` lists every source with whether it was read;
    // `fieldSources` says which document each field came from; `conflicts` holds what
    // the other documents say where they differ. All absent for a single-source reading.
    followDocuments: { type: Boolean, default: undefined },
    autoDraft: { type: Boolean, default: undefined },
    draftedSlug: { type: String },
    autoApproval: { type: Schema.Types.Mixed },
    documents: { type: Schema.Types.Mixed },
    fieldSources: { type: Schema.Types.Mixed },
    conflicts: { type: Schema.Types.Mixed },
    extractionError: { type: String },
    extractionWarnings: { type: [String], default: undefined },
    extractionModel: { type: String },
    extractedAt: { type: Date },

    reviewNotes: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    reviewedAt: { type: Date },
    // Raised by the weekly source watch rather than by a person, so there is no
    // submitting admin. `detectedChange` is the watch's own words for what moved.
    autoDetected: { type: Boolean, default: undefined },
    detectedChange: { type: String, enum: ["documents", "text", "file"] },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: function (this: { autoDetected?: boolean }) {
        return !this.autoDetected;
      },
    },
  },
  { timestamps: true }
);

dataSourceSubmissionSchema.index({ targetType: 1, sportSlug: 1 });
dataSourceSubmissionSchema.index({ status: 1, createdAt: -1 });
// The AI approver counts what it did today, and the digest lists what it did this week.
dataSourceSubmissionSchema.index({ "autoApproval.actedAt": 1 }, { sparse: true });

export const DataSourceSubmission =
  mongoose.models.DataSourceSubmission ||
  mongoose.model<DataSourceSubmissionDocument>("DataSourceSubmission", dataSourceSubmissionSchema);
