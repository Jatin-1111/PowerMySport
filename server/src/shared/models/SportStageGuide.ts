import mongoose, { Document, Schema } from "mongoose";

import type { StageGuide } from "../validation/stageGuideFormat";

/**
 * A hand-authored, India-specific stage guide for one sport — the thing the
 * pathway page renders.
 *
 * Uploaded as JSON by an admin, validated against `stageGuideFormat` at the
 * edge, and stored whole. The payload deliberately lives in one `Mixed` field
 * rather than a mirrored Mongoose schema: Zod is the contract, and maintaining
 * the same shape twice guarantees the two drift. Everything we actually query on
 * — sport, state, status — is a real indexed field above it.
 *
 * SEPARATE FROM `SportBasePath` / `SportStatePath` ON PURPOSE. Those feed
 * /resources and the guidance AI. This feeds the pathway page alone, so the two
 * surfaces can differ in depth and framing without either being a degraded copy
 * of the other.
 */
export type StageGuideStatus = "draft" | "published";

export interface SportStageGuideDocument extends Document {
  sportSlug: string;
  /** `null` for the national guide. A state doc wins over the national one. */
  stateSlug: string | null;
  status: StageGuideStatus;
  formatVersion: number;
  /** Denormalised for the admin list, so it needn't parse every payload. */
  sportName: string;
  stageCount: number;
  verifiedOn?: string;
  /** The validated guide, exactly as uploaded. */
  guide: StageGuide;
  uploadedBy?: mongoose.Types.ObjectId;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SportStageGuideSchema = new Schema<SportStageGuideDocument>(
  {
    sportSlug: { type: String, required: true, lowercase: true, trim: true, index: true },
    stateSlug: { type: String, default: null, lowercase: true, trim: true },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "published",
      index: true,
    },
    formatVersion: { type: Number, required: true },
    sportName: { type: String, required: true },
    stageCount: { type: Number, required: true },
    verifiedOn: String,
    guide: { type: Schema.Types.Mixed, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One guide per sport per scope. Re-uploading the same pair replaces it, which
// is what "upload the corrected file" should mean.
SportStageGuideSchema.index({ sportSlug: 1, stateSlug: 1 }, { unique: true });

export const SportStageGuide =
  (mongoose.models.SportStageGuide as mongoose.Model<SportStageGuideDocument>) ||
  mongoose.model<SportStageGuideDocument>("SportStageGuide", SportStageGuideSchema);

export default SportStageGuide;
