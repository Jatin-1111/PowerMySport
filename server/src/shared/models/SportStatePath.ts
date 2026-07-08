import mongoose, { Document, Schema } from "mongoose";

/**
 * State-specific pathway overlay for one sport × one Indian state.
 * Up to 280 documents (10 sports × 28 states).
 * Complements SportBasePath — guidanceAiService merges both at read time.
 */
export interface SportStatePathDocument extends Document {
  sportSlug: string;
  stateSlug: string;
  stateName: string;
  stateAssociation: {
    name: string;
    acronym?: string;
    website?: string;
    contact?: string;
  };
  topAcademies: Array<{
    name: string;
    city: string;
    specialization?: string;
  }>;
  feeRange: {
    monthly: string;
    equipment: string;
    tournaments: string;
  };
  governmentSchemes: Array<{
    name: string;
    body: string;
    eligibility: string;
    benefit: string;
    howToApply: string;
  }>;
  regionalCalendar: string;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sportStatePathSchema = new Schema<SportStatePathDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, trim: true },
    stateSlug: { type: String, required: true, lowercase: true, trim: true },
    stateName: { type: String, required: true, trim: true },
    stateAssociation: {
      name: { type: String, required: true },
      acronym: { type: String },
      website: { type: String },
      contact: { type: String },
    },
    topAcademies: [
      {
        _id: false,
        name: { type: String, required: true },
        city: { type: String, required: true },
        specialization: { type: String },
      },
    ],
    feeRange: {
      monthly: { type: String, required: true },
      equipment: { type: String, required: true },
      tournaments: { type: String, required: true },
    },
    governmentSchemes: { type: Schema.Types.Mixed, default: [] },
    regionalCalendar: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

sportStatePathSchema.index({ sportSlug: 1, stateSlug: 1 }, { unique: true });

export const SportStatePath =
  mongoose.models.SportStatePath ||
  mongoose.model<SportStatePathDocument>("SportStatePath", sportStatePathSchema);
