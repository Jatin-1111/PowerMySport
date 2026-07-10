import mongoose, { Document, Schema } from "mongoose";

/**
 * A named credit from an Expert who verified a sport's pathway matches their
 * domain. Deliberately keyed by `sportSlug` ALONE, not by a specific
 * `SportPathway` document — pathways are cached per-state (cacheKey =
 * `${sportSlug}_${stateSlug}`, e.g. "cricket_punjab" vs "cricket_delhi" vs
 * "cricket_any"), but an expert's knowledge of level progression, benchmarks,
 * trial info, and talent signals is sport-intrinsic, not state-intrinsic —
 * only local resources/tournaments/scholarships vary by state, and those
 * live in separate canonical collections the expert isn't attesting to.
 * One verification here therefore applies to every state variant of the
 * sport, attached to the response at read time (see PathwayService).
 */
export interface PathwayExpertVerificationDocument extends Document {
  sportSlug: string;
  sportName: string;
  expertId: mongoose.Types.ObjectId;
  expertName: string;
  expertPhotoUrl?: string;
  verifiedAt: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pathwayExpertVerificationSchema =
  new Schema<PathwayExpertVerificationDocument>(
    {
      sportSlug: { type: String, required: true, lowercase: true, index: true },
      sportName: { type: String, required: true, trim: true },
      expertId: { type: Schema.Types.ObjectId, ref: "Expert", required: true },
      expertName: { type: String, required: true },
      expertPhotoUrl: { type: String },
      verifiedAt: { type: Date, default: Date.now },
      note: { type: String, trim: true, maxlength: 500 },
    },
    { timestamps: true },
  );

// One verification per expert per sport (upserted, not duplicated).
pathwayExpertVerificationSchema.index(
  { sportSlug: 1, expertId: 1 },
  { unique: true },
);

export const PathwayExpertVerification =
  mongoose.models.PathwayExpertVerification ||
  mongoose.model<PathwayExpertVerificationDocument>(
    "PathwayExpertVerification",
    pathwayExpertVerificationSchema,
  );
