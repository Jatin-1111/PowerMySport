import mongoose, { Document, Schema } from "mongoose";

// ─── Pathway personal notes (Layer-2 personalization) ────────────────────────
//
// One small AI-written note per raw pathway level (1–5), tailored to an
// ANONYMIZED child signature: age band + standing tier + ambition + budget +
// weekly hours. Deliberately no name and no exact age — the client renders
// the "For Aarav" label itself, so no PII reaches the server, and every
// 11–13-year-old tier-2 national-ambition badminton family in Punjab shares
// one cached generation (cost control).
//
// The cached SportPathway (sport|state) stays untouched and shared — this is
// a thin overlay, never a per-child pathway regeneration.

export interface PersonalNote {
  level: number; // raw pathway level 1–5
  note: string;
}

export interface PathwayPersonalNoteDocument extends Document {
  cacheKey: string;
  sportSlug: string;
  state: string;
  notes: PersonalNote[];
  createdAt: Date;
}

const PathwayPersonalNoteSchema = new Schema<PathwayPersonalNoteDocument>(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    sportSlug: { type: String, required: true },
    state: { type: String, required: true },
    notes: [
      {
        level: { type: Number, required: true, min: 1, max: 5 },
        note: { type: String, required: true },
        _id: false,
      },
    ],
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

// Notes age out after 30 days so refreshed pathway content and cost-model
// changes propagate without a manual purge.
PathwayPersonalNoteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const PathwayPersonalNote =
  mongoose.models.PathwayPersonalNote ||
  mongoose.model<PathwayPersonalNoteDocument>(
    "PathwayPersonalNote",
    PathwayPersonalNoteSchema,
  );
