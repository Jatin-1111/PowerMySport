import mongoose, { Document, Schema } from "mongoose";

/**
 * "EXPERIENCE" replaced "BLOG" when the blog became Experience (migration 39
 * rewrites the stored rows). The API still accepts "BLOG" on the wire and
 * normalizes it, so existing clients keep working until the community app moves
 * over — see `normalizeLikeTargetType` in ExperienceService.
 */
export type ExperienceLikeTargetType = "EXPERIENCE" | "COMMENT";

export interface ExperienceLikeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  targetType: ExperienceLikeTargetType;
  targetId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const experienceLikeSchema = new Schema<ExperienceLikeDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["EXPERIENCE", "COMMENT"],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

experienceLikeSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
experienceLikeSchema.index({ targetType: 1, targetId: 1 });

export const ExperienceLike = mongoose.model<ExperienceLikeDocument>(
  "ExperienceLike",
  experienceLikeSchema
);
