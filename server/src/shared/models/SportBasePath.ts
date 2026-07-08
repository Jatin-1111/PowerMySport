import mongoose, { Document, Schema } from "mongoose";

/**
 * Universal, state-agnostic base pathway for one sport.
 * One document per supported sport (10 total).
 * Does NOT contain localResources or governmentSchemes — those live in SportStatePath.
 * guidanceAiService reads this to ground the AI without re-generating per-state content.
 */
export interface BaseLevel {
  level: number;
  label: string;
  title: string;
  description: string;
  keyFocus: string;
  ageRange: string;
  competitions: string;
  steps: string[];
  benchmarks?: {
    description: string;
    metrics: Array<{ metric: string; target: string; checkpointMonth?: number }>;
  };
  trialInfo?: {
    typicalMonths: string;
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
  academicIntegration?: string;
  proactiveDocuments?: string[];
}

export interface SportBasePathDocument extends Document {
  sportSlug: string;
  sportName: string;
  category: string;
  overview: string;
  levels: BaseLevel[];
  equipment: Array<{ level: string; items: string[]; estimatedCost: string }>;
  careers: Array<{ role: string; description: string; demand: string }>;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const baseLevelSchema = new Schema<BaseLevel>(
  {
    level: { type: Number, required: true },
    label: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    keyFocus: { type: String, required: true },
    ageRange: { type: String, required: true },
    competitions: { type: String, required: true },
    steps: [{ type: String }],
    benchmarks: { type: Schema.Types.Mixed },
    trialInfo: { type: Schema.Types.Mixed },
    injuryRisks: { type: Schema.Types.Mixed },
    talentSignals: { type: Schema.Types.Mixed },
    mentalSkillsFocus: [{ type: String }],
    coachSelectionGuide: { type: Schema.Types.Mixed },
    academicIntegration: { type: String },
    proactiveDocuments: [{ type: String }],
  },
  { _id: false },
);

const sportBasePathSchema = new Schema<SportBasePathDocument>(
  {
    sportSlug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sportName: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    overview: { type: String, required: true },
    levels: { type: [baseLevelSchema], default: [] },
    equipment: { type: Schema.Types.Mixed, default: [] },
    careers: { type: Schema.Types.Mixed, default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const SportBasePath =
  mongoose.models.SportBasePath ||
  mongoose.model<SportBasePathDocument>("SportBasePath", sportBasePathSchema);
