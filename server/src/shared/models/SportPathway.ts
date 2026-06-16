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
    isVerified: { type: Boolean, default: false },
    lookupCount: { type: Number, default: 1 },
  },
  { timestamps: true },
);

export const SportPathway =
  mongoose.models.SportPathway ||
  mongoose.model<SportPathwayDocument>("SportPathway", sportPathwaySchema);
