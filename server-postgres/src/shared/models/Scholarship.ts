import mongoose, { Document, Schema } from "mongoose";

/**
 * Canonical, scraped/grounded scholarship record.
 * Populated/refreshed only by the scraper (RealDataScraperService).
 */
export interface ScholarshipDocument extends Document {
  sportSlug: string;
  city?: string;
  name: string;
  provider: string;
  description: string;
  eligibility: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];
  sourceUrls: string[];
  isVerified: boolean;
  lastScrapedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const scholarshipSchema = new Schema<ScholarshipDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, index: true },
    city: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    provider: { type: String, required: true },
    description: { type: String, required: true },
    eligibility: { type: String, required: true },
    prerequisiteId: { type: String },
    prerequisiteName: { type: String },
    prerequisiteGuide: [{ type: String }],
    documentChecklist: [{ type: String }],
    sourceUrls: { type: [String], default: [] },
    isVerified: { type: Boolean, default: false },
    lastScrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

scholarshipSchema.index({ sportSlug: 1, name: 1 }, { unique: true });

export const Scholarship =
  mongoose.models.Scholarship ||
  mongoose.model<ScholarshipDocument>("Scholarship", scholarshipSchema);
