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
}

export interface Scholarship {
  name: string;
  provider: string;
  description: string;
  eligibility: string;
}

export interface University {
  name: string;
  location: string;
  admissionCriteria: string;
  sportsQuotaDetails: string;
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
  },
  { _id: false },
);

const scholarshipSchema = new Schema<Scholarship>(
  {
    name: { type: String, required: true },
    provider: { type: String, required: true },
    description: { type: String, required: true },
    eligibility: { type: String, required: true },
  },
  { _id: false },
);

const universitySchema = new Schema<University>(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
    admissionCriteria: { type: String, required: true },
    sportsQuotaDetails: { type: String, required: true },
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
      unique: true,
      lowercase: true,
      index: true,
    },
    sportName: { type: String, required: true, trim: true },
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
  },
  { timestamps: true },
);

export const SportPathway =
  mongoose.models.SportPathway ||
  mongoose.model<SportPathwayDocument>("SportPathway", sportPathwaySchema);
