import mongoose, { Document, Schema } from "mongoose";
import {
  DEFAULT_EXPERIENCE_CATEGORY,
  EXPERIENCE_CATEGORIES,
  EXPERIENCE_SUBJECT_KINDS,
  SIGNAL_KEYS,
  SIGNAL_VALUES,
  type ExperienceCategory,
  type ExperienceSubjectKind,
  type SignalKey,
  type SignalValue,
} from "../constants/experience";

export type ExperienceStatus = "PUBLISHED" | "DRAFT";

/**
 * PENDING is only ever the default for experiences anchored to a named
 * individual (see `requiresPreModeration`). Everything else publishes straight
 * away and is reportable after the fact, exactly as blog posts always were.
 */
export type ExperienceModerationStatus = "PENDING" | "APPROVED" | "FLAGGED" | "REMOVED";

export interface ExperienceSubject {
  kind: ExperienceSubjectKind;
  refId: mongoose.Types.ObjectId;
  /**
   * The subject's name at the time of writing. Denormalised on purpose: the
   * feed card renders without a join across six possible collections, and an
   * experience survives its subject being deleted or renamed.
   */
  nameSnapshot: string;
  slugSnapshot?: string | null;
}

export interface ExperienceDocument extends Document {
  authorId: mongoose.Types.ObjectId;
  /**
   * Optional. A parent with two lines and a photo has written a complete
   * experience; requiring a headline first was the single biggest reason the
   * old blog composer read as "write an essay". Derived from the opening
   * sentence when absent.
   */
  title?: string;
  excerpt: string;
  coverImageKey?: string | null;
  coverImageUrl?: string | null;
  /** What the experience is about. Replaces half of the old `topic` field. */
  category: ExperienceCategory;
  /** Which sport, when it is about one. The other half of the old `topic`. */
  sport?: string | null;
  tags: string[];
  /** Rich-text HTML produced by the Tiptap editor; sanitized on render. */
  content: string;
  /** Set when this is about a real tournament, venue, academy, coach or expert. */
  subject?: ExperienceSubject | null;
  /** Three-point answers; only meaningful alongside a subject. */
  signals?: Partial<Record<SignalKey, SignalValue>> | null;
  /** When it happened — distinct from when it was written. */
  attendedAt?: Date | null;
  moderationStatus: ExperienceModerationStatus;
  moderationNotes?: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  status: ExperienceStatus;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ExperienceSubject>(
  {
    kind: { type: String, enum: EXPERIENCE_SUBJECT_KINDS, required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    nameSnapshot: { type: String, required: true, trim: true, maxlength: 200 },
    slugSnapshot: { type: String, default: null, trim: true, maxlength: 200 },
  },
  { _id: false }
);

// A flat subdocument rather than a Map: the entity-page aggregate is then a
// plain $group over known paths, and an unknown key cannot be written.
const signalsSchemaDefinition = SIGNAL_KEYS.reduce<Record<string, unknown>>((definition, key) => {
  definition[key] = { type: String, enum: SIGNAL_VALUES, required: false };
  return definition;
}, {});

const signalsSchema = new Schema(signalsSchemaDefinition, { _id: false });

const experienceSchema = new Schema<ExperienceDocument>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    coverImageKey: { type: String, default: null },
    coverImageUrl: { type: String, default: null },
    category: {
      type: String,
      enum: EXPERIENCE_CATEGORIES,
      default: DEFAULT_EXPERIENCE_CATEGORY,
      index: true,
    },
    sport: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 8,
        message: "An experience can have at most 8 tags",
      },
    },
    content: {
      type: String,
      default: "",
      maxlength: 100_000,
    },
    subject: { type: subjectSchema, default: null },
    signals: { type: signalsSchema, default: null },
    attendedAt: { type: Date, default: null },
    moderationStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "FLAGGED", "REMOVED"],
      default: "APPROVED",
      index: true,
    },
    moderationNotes: { type: String, default: null },
    likeCount: { type: Number, default: 0, index: true },
    commentCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["PUBLISHED", "DRAFT"],
      default: "PUBLISHED",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

experienceSchema.index({ createdAt: -1 });
experienceSchema.index({ category: 1, createdAt: -1 });
experienceSchema.index({ sport: 1, createdAt: -1 });
experienceSchema.index({ authorId: 1, createdAt: -1 });
experienceSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
// Backs the "Parent experiences" band on a tournament / venue / academy / coach
// page, which reads one subject's published, approved experiences newest-first.
experienceSchema.index({
  "subject.kind": 1,
  "subject.refId": 1,
  status: 1,
  isDeleted: 1,
  createdAt: -1,
});
// Backs the moderation queue for people-anchored experiences.
experienceSchema.index({ moderationStatus: 1, createdAt: -1 });

// MongoDB allows only ONE text index per collection, so this cannot be edited
// in place on a live database: Mongoose would try to build it alongside the old
// one and MongoDB rejects the conflict. This is the same trap migration 27 hit
// on the blog collection. Migration 39 drops `blog_search_v2` and builds this;
// the explicit name is what lets the migration recognise its own work.
//
// `subject.nameSnapshot` is in here so that searching a tournament or academy
// by name surfaces the experiences written about it, not just the ones that
// happened to mention it in the body.
experienceSchema.index(
  {
    title: "text",
    excerpt: "text",
    tags: "text",
    "subject.nameSnapshot": "text",
    content: "text",
  },
  {
    name: "experience_search_v1",
    weights: { title: 10, tags: 6, "subject.nameSnapshot": 6, excerpt: 4, content: 1 },
  }
);

export const Experience = mongoose.model<ExperienceDocument>("Experience", experienceSchema);
