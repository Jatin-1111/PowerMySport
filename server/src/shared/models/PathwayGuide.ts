import mongoose, { Document, Schema } from "mongoose";

import type {
  PathwayAction,
  PathwayNextStep,
  PathwayPoint,
  PathwayQuestion,
  PathwayStage,
} from "../validation/pathwayGuideFormat";
import { PATHWAY_FORMAT_VERSION } from "../validation/pathwayGuideFormat";

// ─── Pathway guide ───────────────────────────────────────────────────────────
//
// The parent-facing pathway for one sport, as a real document tree rather than a
// `Mixed` blob. The shape it stores is `PathwayGuideSchema` in
// `validation/pathwayGuideFormat.ts` — that Zod schema is the contract; this is
// how it lands in Mongo.
//
// Stages are a subdocument ARRAY, not a blob, because the CMS edits one stage at
// a time: `stages.$[s]` positional updates mean two people editing different
// stages of the same sport don't overwrite each other, and reordering is a
// rewrite of `order` rather than of the content.
//
// One document per sport. There was a state-overlay dimension here — a second
// document per (sport, state) that replaced the national one for readers in that
// state — removed Aug 2026: we author one pathway per sport and nothing was
// generating state-specific content.

export interface PathwayStageDocument extends PathwayStage {
  /** 1..n, contiguous. The CMS rewrites this on reorder; readers sort by it. */
  order: number;
}

export interface PathwayGuideDocument extends Document {
  sportSlug: string;
  sportName: string;
  status: "draft" | "published";
  formatVersion: number;
  intro: {
    eyebrow?: string;
    headline?: string;
    description?: string;
  };
  sportIntro: string[];
  stages: PathwayStageDocument[];
  reviewedOn?: string;
  updatedBy?: mongoose.Types.ObjectId;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const actionSchema = new Schema<PathwayAction>(
  {
    label: { type: String, required: true, trim: true },
    href: { type: String, trim: true },
  },
  { _id: false }
);

const questionSchema = new Schema<PathwayQuestion>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, trim: true },
  },
  { _id: false }
);

const pointSchema = new Schema<PathwayPoint>(
  {
    title: { type: String, required: true, trim: true },
    detail: { type: String, trim: true },
  },
  { _id: false }
);

const nextStepSchema = new Schema<PathwayNextStep>(
  {
    when: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// `_id: false` throughout: every one of these is addressed by its parent stage's
// `key` plus an index, never by an id of its own, and letting Mongo mint ObjectIds
// for each bullet would put hundreds of unused ids on the wire to the browser.
const stageSchema = new Schema<PathwayStageDocument>(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    order: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    ageRange: { type: String, required: true, trim: true },
    coreQuestion: { type: String, required: true, trim: true },
    overview: { type: String, required: true, trim: true },
    questions: { type: [questionSchema], default: [] },
    signals: { type: [pointSchema], default: [] },
    decisions: { type: [pointSchema], default: [] },
    nextStepLead: { type: String, trim: true },
    nextSteps: { type: [nextStepSchema], default: [] },
    primaryAction: { type: actionSchema, default: undefined },
    helpLinks: { type: [actionSchema], default: [] },
  },
  { _id: false }
);

const pathwayGuideSchema = new Schema<PathwayGuideDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, trim: true },
    sportName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true,
    },
    formatVersion: { type: Number, default: PATHWAY_FORMAT_VERSION },
    intro: {
      eyebrow: { type: String, trim: true },
      headline: { type: String, trim: true },
      description: { type: String, trim: true },
    },
    sportIntro: { type: [String], default: [] },
    stages: { type: [stageSchema], default: [] },
    reviewedOn: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

pathwayGuideSchema.index({ sportSlug: 1 }, { unique: true });

export const PathwayGuide =
  (mongoose.models.PathwayGuide as mongoose.Model<PathwayGuideDocument>) ||
  mongoose.model<PathwayGuideDocument>("PathwayGuide", pathwayGuideSchema);
