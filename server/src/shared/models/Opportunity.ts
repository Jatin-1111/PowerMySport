import mongoose, { Document, Schema } from "mongoose";

import {
  OPPORTUNITY_TRACKS,
  OWNER_TYPES,
  SELECTION_MODES,
  type OpportunityCategory,
  type OpportunityTrack,
} from "../validation/opportunityFormat";

/**
 * An admission route or a scholarship a young athlete can pursue: the DU
 * sports quota, a Khelo India athlete scholarship, an ITF development grant.
 *
 * Curated by hand through the admin CMS (opportunityAdminController.ts) and
 * validated by opportunityFormat.ts, which owns the shape. Deliberately not
 * fed by a scraper: every figure here is one a parent may act on, so each
 * record carries its sources and the date someone last checked them.
 *
 * Replaces nothing yet, but supersedes the scraped Scholarship and University
 * collections, which hold unverified free text that no page reads.
 */
export interface OpportunityDocument extends Document {
  slug: string;
  track: OpportunityTrack;
  category: OpportunityCategory;
  title: string;
  summary?: string;
  owner?: { name: string; type: (typeof OWNER_TYPES)[number] };
  sports: string[];
  allSports: boolean;
  geography?: { scope: string; state?: string };
  eligibility?: {
    ageMin?: number;
    ageMax?: number;
    ageNote?: string;
    gender?: string;
    level?: string;
    academic?: string;
    income?: string;
  };
  selection?: (typeof SELECTION_MODES)[number];
  benefit?: {
    summary: string;
    amount?: { value: number; currency: string; period: string; note?: string };
  };
  cycle?: {
    label?: string;
    opensOn?: string;
    closesOn?: string;
    keyDates: Array<{ label: string; date: string }>;
  };
  steps: string[];
  keyFacts: string[];
  applyUrl?: string;
  sources: Array<{ label: string; url: string; publishedOn?: string }>;
  lastVerifiedOn?: string;
  verificationNote?: string;
  status: "draft" | "published";
  publishedAt?: Date | null;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const opportunitySchema = new Schema<OpportunityDocument>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    track: { type: String, enum: OPPORTUNITY_TRACKS, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String },
    owner: {
      _id: false,
      name: { type: String },
      type: { type: String, enum: OWNER_TYPES },
    },
    sports: { type: [String], default: [] },
    allSports: { type: Boolean, default: false },
    geography: {
      _id: false,
      scope: { type: String },
      state: { type: String },
    },
    eligibility: {
      _id: false,
      ageMin: { type: Number },
      ageMax: { type: Number },
      ageNote: { type: String },
      gender: { type: String },
      level: { type: String },
      academic: { type: String },
      income: { type: String },
    },
    selection: { type: String, enum: SELECTION_MODES },
    benefit: {
      _id: false,
      summary: { type: String },
      amount: {
        _id: false,
        value: { type: Number },
        currency: { type: String },
        period: { type: String },
        note: { type: String },
      },
    },
    cycle: {
      _id: false,
      label: { type: String },
      opensOn: { type: String },
      closesOn: { type: String },
      keyDates: {
        type: [{ _id: false, label: { type: String }, date: { type: String } }],
        default: [],
      },
    },
    steps: { type: [String], default: [] },
    keyFacts: { type: [String], default: [] },
    applyUrl: { type: String },
    sources: {
      type: [{ _id: false, label: { type: String }, url: { type: String }, publishedOn: String }],
      default: [],
    },
    lastVerifiedOn: { type: String },
    verificationNote: { type: String },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// The public pages ask for one track's published entries, then filter by sport.
opportunitySchema.index({ track: 1, status: 1 });

export const Opportunity = mongoose.model<OpportunityDocument>("Opportunity", opportunitySchema);
