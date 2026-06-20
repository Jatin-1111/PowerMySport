import mongoose, { Document, Schema } from "mongoose";

/** A single level in the progression pyramid */
export interface PathwayLevel {
  level: number; // 1 = Grassroots … 5 = International
  label: string; // e.g. "District"
  title: string; // e.g. "District & Zonal Level"
  description: string;
  keyFocus: string;
  ageRange: string;
  competitions: string;
  steps: string[];
  governingBody?: string; // e.g. "BCCI", "BAI"
}

export interface Tournament {
  name: string;
  level: string;
  description: string;
  ageGroup: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];
}

export interface Scholarship {
  name: string;
  provider: string;
  description: string;
  eligibility: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];
}

export interface University {
  name: string;
  location: string;
  admissionCriteria: string;
  sportsQuotaDetails: string;
  prerequisiteId?: string;
  prerequisiteName?: string;
  prerequisiteGuide?: string[];
  documentChecklist?: string[];
}

export interface Equipment {
  level: string; // e.g., "Beginner", "Professional"
  items: string[];
  estimatedCost: string; // e.g., "₹2,000 - ₹5,000"
}

export interface Career {
  role: string;
  description: string;
  demand: string;
}

export interface SportPathwayDocument extends Document {
  /** slug of the sport, e.g. "cricket" */
  sportSlug: string;
  /** Display name, e.g. "Cricket" */
  sportName: string;
  /** Composite cache key: sportSlug_age_city e.g. "cricket_12_ludhiana" */
  cacheKey?: string;
  /** Category the AI determined */
  category?: string;
  /** Short intro for the sport pathway */
  overview: string;
  /** Five-level progression data */
  levels: PathwayLevel[];
  tournaments: Tournament[];
  scholarships: Scholarship[];
  universities: University[];
  equipment: Equipment[];
  careers: Career[];
  /** false = AI-generated, pending admin review */
  isVerified: boolean;
  /** Number of times this pathway has been looked up */
  lookupCount: number;
  /** Timestamp of last Gemini-powered refresh (distinct from updatedAt which fires on lookupCount increments) */
  lastRefreshedAt?: Date;
  /** Whether a background refresh is currently in-progress (prevents duplicate refresh jobs) */
  refreshInProgress?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pathwayLevelSchema = new Schema<PathwayLevel>(
  {
    level: { type: Number, required: true, min: 1, max: 5 },
    label: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    keyFocus: { type: String, required: true },
    ageRange: { type: String, required: true },
    competitions: { type: String, required: true },
    steps: [{ type: String }],
    governingBody: { type: String, default: "" },
  },
  { _id: false },
);

const tournamentSchema = new Schema<Tournament>(
  {
    name: { type: String, required: true },
    level: { type: String, required: true },
    description: { type: String, required: true },
    ageGroup: { type: String, required: true },
    prerequisiteId: { type: String },
    prerequisiteName: { type: String },
    prerequisiteGuide: [{ type: String }],
    documentChecklist: [{ type: String }],
  },
  { _id: false },
);

const scholarshipSchema = new Schema<Scholarship>(
  {
    name: { type: String, required: true },
    provider: { type: String, required: true },
    description: { type: String, required: true },
    eligibility: { type: String, required: true },
    prerequisiteId: { type: String },
    prerequisiteName: { type: String },
    prerequisiteGuide: [{ type: String }],
    documentChecklist: [{ type: String }],
  },
  { _id: false },
);

const universitySchema = new Schema<University>(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    admissionCriteria: { type: String, required: true },
    sportsQuotaDetails: { type: String, required: true },
    prerequisiteId: { type: String },
    prerequisiteName: { type: String },
    prerequisiteGuide: [{ type: String }],
    documentChecklist: [{ type: String }],
  },
  { _id: false },
);

const equipmentSchema = new Schema<Equipment>(
  {
    level: { type: String, required: true },
    items: [{ type: String }],
    estimatedCost: { type: String, required: true },
  },
  { _id: false },
);

const careerSchema = new Schema<Career>(
  {
    role: { type: String, required: true },
    description: { type: String, required: true },
    demand: { type: String, required: true },
  },
  { _id: false },
);

const sportPathwaySchema = new Schema<SportPathwayDocument>(
  {
    sportSlug: {
      type: String,
      required: true,
      // NOTE: unique index removed to allow per-age/city variants of the same sport.
      // Run migration: db.sportpathways.dropIndex("sportSlug_1") in production.
      lowercase: true,
      index: true,
    },
    sportName: { type: String, required: true, trim: true },
    // Composite cache key: sportSlug_age_city — unique per age+city combo
    cacheKey: { type: String, index: true, sparse: true },
    category: { type: String, default: "Other" },
    overview: { type: String, default: "" },
    levels: [pathwayLevelSchema],
    tournaments: { type: [tournamentSchema], default: [] },
    scholarships: { type: [scholarshipSchema], default: [] },
    universities: { type: [universitySchema], default: [] },
    equipment: { type: [equipmentSchema], default: [] },
    careers: { type: [careerSchema], default: [] },
    isVerified: { type: Boolean, default: false },
    lookupCount: { type: Number, default: 1 },
    lastRefreshedAt: { type: Date, default: null },
    refreshInProgress: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const SportPathway =
  mongoose.models.SportPathway ||
  mongoose.model<SportPathwayDocument>("SportPathway", sportPathwaySchema);
