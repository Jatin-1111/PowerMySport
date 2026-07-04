import mongoose, { Document, Schema } from "mongoose";

/** A single level in the progression pyramid */
export interface PathwayLevel {
  level: number; // 1 = entry tier … 5 = elite/global tier (ascending, sport-agnostic)
  label: string; // always one of: Beginner, Intermediate, Advanced, National, International
  title: string; // short, plain-English, sport-specific phrase, e.g. "Playing District-Level Cricket Matches"
  description: string;
  keyFocus: string;
  ageRange: string;
  competitions: string;
  steps: string[];
  governingBody?: string; // e.g. "BCCI", "BAI"
  localResources?: {
    academies?: string[];
    facilities?: string[];
    governingBodies?: string[];
  };
  benchmarks?: {
    description: string;
    metrics: Array<{ metric: string; target: string; checkpointMonth?: number }>;
  };
  trialInfo?: {
    typicalMonths: string;
    precisionLevel?: "exact" | "approximate";
    registrationProcess: string;
    eligibilityAge: string;
    selectionCriteria: string[];
    tips: string[];
  };
  injuryRisks?: {
    commonInjuries: string[];
    preventionTips: string[];
    warningSignsToWatch: string[];
  };
  talentSignals?: {
    physicalMarkers: string[];
    cognitiveMarkers: string[];
    behavioralMarkers: string[];
  };
  mentalSkillsFocus?: string[];
  coachSelectionGuide?: {
    mustHave: string[];
    niceToHave: string[];
    redFlags: string[];
    questionsToAsk: string[];
  };
  governmentSchemes?: Array<{
    name: string;
    body: string;
    eligibility: string;
    benefit: string;
    howToApply: string;
    sourceURL?: string;
    verifiedAsOf?: Date;
  }>;
  academicIntegration?: string;
  proactiveDocuments?: string[];
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
  /** Composite cache key: sportSlug_state e.g. "cricket_punjab" */
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
  tournamentsVerifiedEmpty?: boolean;
  scholarshipsVerifiedEmpty?: boolean;
  universitiesVerifiedEmpty?: boolean;
  /** false = AI-generated, pending admin review. true = an admin has reviewed/edited this against expert input */
  isVerified: boolean;
  /** When an admin last marked this pathway verified (cleared when unverified) */
  verifiedAt?: Date;
  /** Which admin last marked this pathway verified (cleared when unverified) */
  verifiedBy?: mongoose.Types.ObjectId;
  /** Number of times this pathway has been looked up */
  lookupCount: number;
  /** Timestamp of last Gemini-powered refresh for slow-changing content */
  contentRefreshedAt?: Date;
  /** Timestamp of last Gemini-powered refresh for fast-changing financial data */
  financialDataRefreshedAt?: Date;
  /** Whether a background refresh is currently in-progress for content */
  contentRefreshInProgress?: boolean;
  /** Whether a background refresh is currently in-progress for financial data */
  financialRefreshInProgress?: boolean;
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
    governingBody: { type: String },
    localResources: {
      academies: [{ type: String }],
      facilities: [{ type: String }],
      governingBodies: [{ type: String }],
    },
    benchmarks: {
      description: { type: String },
      metrics: [{ metric: { type: String }, target: { type: String }, checkpointMonth: { type: Number }, _id: false }],
    },
    trialInfo: {
      typicalMonths: { type: String },
      precisionLevel: { type: String, enum: ["exact", "approximate"] },
      registrationProcess: { type: String },
      eligibilityAge: { type: String },
      selectionCriteria: [{ type: String }],
      tips: [{ type: String }],
    },
    injuryRisks: {
      commonInjuries: [{ type: String }],
      preventionTips: [{ type: String }],
      warningSignsToWatch: [{ type: String }],
    },
    talentSignals: {
      physicalMarkers: [{ type: String }],
      cognitiveMarkers: [{ type: String }],
      behavioralMarkers: [{ type: String }],
    },
    mentalSkillsFocus: [{ type: String }],
    coachSelectionGuide: {
      mustHave: [{ type: String }],
      niceToHave: [{ type: String }],
      redFlags: [{ type: String }],
      questionsToAsk: [{ type: String }],
    },
    governmentSchemes: [
      {
        name: { type: String },
        body: { type: String },
        eligibility: { type: String },
        benefit: { type: String },
        howToApply: { type: String },
        sourceURL: { type: String },
        verifiedAsOf: { type: Date },
        _id: false,
      },
    ],
    academicIntegration: { type: String },
    proactiveDocuments: [{ type: String }],
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
    // Composite cache key: sportSlug_state — unique per state combo
    cacheKey: { type: String, index: true, sparse: true },
    category: { type: String, default: "Other" },
    overview: { type: String, default: "" },
    levels: [pathwayLevelSchema],
    tournaments: { type: [tournamentSchema], default: [] },
    scholarships: { type: [scholarshipSchema], default: [] },
    universities: { type: [universitySchema], default: [] },
    equipment: { type: [equipmentSchema], default: [] },
    careers: { type: [careerSchema], default: [] },
    tournamentsVerifiedEmpty: { type: Boolean, default: false },
    scholarshipsVerifiedEmpty: { type: Boolean, default: false },
    universitiesVerifiedEmpty: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    lookupCount: { type: Number, default: 1 },
    contentRefreshedAt: { type: Date, default: null },
    financialDataRefreshedAt: { type: Date, default: null },
    contentRefreshInProgress: { type: Boolean, default: false },
    financialRefreshInProgress: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const SportPathway =
  mongoose.models.SportPathway ||
  mongoose.model<SportPathwayDocument>("SportPathway", sportPathwaySchema);
