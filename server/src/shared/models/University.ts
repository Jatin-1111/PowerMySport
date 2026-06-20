import mongoose, { Document, Schema } from "mongoose";

/**
 * Canonical, scraped/grounded university sports-quota record.
 * Populated/refreshed only by the scraper (RealDataScraperService).
 */
export interface UniversityDocument extends Document {
  sportSlug: string;
  city?: string;
  name: string;
  location: string;
  admissionCriteria: string;
  sportsQuotaDetails: string;
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

const universitySchema = new Schema<UniversityDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, index: true },
    city: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    admissionCriteria: { type: String, required: true },
    sportsQuotaDetails: { type: String, required: true },
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

universitySchema.index({ sportSlug: 1, name: 1 }, { unique: true });

export const University =
  mongoose.models.University ||
  mongoose.model<UniversityDocument>("University", universitySchema);
