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
  | "TOURNAMENT_CALENDAR";

export type DataSourceKind = "PDF" | "LINK";

export type DataSourceStatus =
  | "PENDING_EXTRACTION"
  | "EXTRACTION_FAILED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface DataSourceSubmissionDocument extends Document {
  targetType: DataSourceTargetType;
  sportSlug: string;
  /** Which Federation doc this feeds — required for FEDERATION and CURATED_TOURNAMENT */
  federationSlug?: string;
  /** Which curated Tournament doc this feeds — required for CURATED_TOURNAMENT */
  tournamentSlug?: string;

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
  extractionError?: string;
  /** Non-fatal validation notes on a successful extraction (e.g. "149 of 151 entries were dropped: …") */
  extractionWarnings?: string[];
  extractionModel?: string;
  extractedAt?: Date;

  reviewNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  submittedBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const dataSourceSubmissionSchema = new Schema<DataSourceSubmissionDocument>(
  {
    targetType: {
      type: String,
      enum: ["FEDERATION", "CURATED_TOURNAMENT", "TOURNAMENT_CALENDAR"],
      required: true,
    },
    sportSlug: { type: String, required: true, lowercase: true, index: true },
    federationSlug: { type: String, lowercase: true, trim: true },
    tournamentSlug: { type: String, lowercase: true, trim: true },

    sourceKind: { type: String, enum: ["PDF", "LINK"], required: true },
    sourceUrl: { type: String },
    s3Key: { type: String },
    fileName: { type: String },
    originUrl: { type: String },

    status: {
      type: String,
      enum: [
        "PENDING_EXTRACTION",
        "EXTRACTION_FAILED",
        "PENDING_REVIEW",
        "APPROVED",
        "REJECTED",
      ],
      default: "PENDING_EXTRACTION",
      index: true,
    },
    extractedData: { type: Schema.Types.Mixed },
    citations: { type: Schema.Types.Mixed },
    extractionError: { type: String },
    extractionWarnings: { type: [String], default: undefined },
    extractionModel: { type: String },
    extractedAt: { type: Date },

    reviewNotes: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    reviewedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
  },
  { timestamps: true },
);

dataSourceSubmissionSchema.index({ targetType: 1, sportSlug: 1 });
dataSourceSubmissionSchema.index({ status: 1, createdAt: -1 });

export const DataSourceSubmission =
  mongoose.models.DataSourceSubmission ||
  mongoose.model<DataSourceSubmissionDocument>(
    "DataSourceSubmission",
    dataSourceSubmissionSchema,
  );
