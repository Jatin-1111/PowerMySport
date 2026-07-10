import mongoose, { Document, Schema } from "mongoose";

export interface EligibilityCategory {
  name: string;
  maxAge: number;
  genders: string[];
  minRanking?: string;
  notes?: string;
}

export interface EligibilityCriteria {
  ageCutoffRule?: string;
  categories: EligibilityCategory[];
  registrationRequired: boolean;
  stateAssociationFirst: boolean;
  notes?: string;
}

export interface StateAssociation {
  name: string;
  state: string;
  website?: string;
}

export interface FederationDocument extends Document {
  slug: string;
  name: string;
  acronym: string;
  sportSlug: string;
  type: "govt" | "national" | "hybrid";
  about: string;
  founded?: number;
  headquarters?: string;
  website?: string;
  officialCalendarUrl?: string;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  affiliations?: string[];
  stateAssociations?: StateAssociation[];
  keyFacts?: string[];
  eligibilityCriteria?: EligibilityCriteria;
  registrationSteps?: string[];
  requiredDocuments?: string[];
  contact?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  dataVerifiedAt?: Date;
  sourceUrls?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EligibilityCategorySchema = new Schema<EligibilityCategory>(
  {
    name: { type: String, required: true },
    maxAge: { type: Number, required: true },
    genders: [{ type: String }],
    minRanking: String,
    notes: String,
  },
  { _id: false },
);

const EligibilityCriteriaSchema = new Schema<EligibilityCriteria>(
  {
    ageCutoffRule: String,
    categories: [EligibilityCategorySchema],
    registrationRequired: { type: Boolean, default: true },
    stateAssociationFirst: { type: Boolean, default: true },
    notes: String,
  },
  { _id: false },
);

const StateAssociationSchema = new Schema<StateAssociation>(
  {
    name: { type: String, required: true },
    state: { type: String, required: true },
    website: String,
  },
  { _id: false },
);

const FederationSchema = new Schema<FederationDocument>(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true },
    acronym: { type: String, required: true },
    sportSlug: { type: String, required: true, lowercase: true },
    type: {
      type: String,
      enum: ["govt", "national", "hybrid"],
      required: true,
    },
    about: { type: String, required: true },
    founded: Number,
    headquarters: String,
    website: String,
    officialCalendarUrl: String,
    socialLinks: {
      twitter: String,
      instagram: String,
      facebook: String,
      youtube: String,
    },
    affiliations: [String],
    stateAssociations: [StateAssociationSchema],
    keyFacts: [String],
    eligibilityCriteria: EligibilityCriteriaSchema,
    registrationSteps: [String],
    requiredDocuments: [String],
    contact: {
      email: String,
      phone: String,
      address: String,
    },
    dataVerifiedAt: Date,
    sourceUrls: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

FederationSchema.index({ sportSlug: 1 });

export const Federation = mongoose.model<FederationDocument>(
  "Federation",
  FederationSchema,
);
