import mongoose, { Document, Schema } from "mongoose";

export interface ExperienceCommentDocument extends Document {
  experienceId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  /** null for top-level comments, set for one-level replies. */
  parentId?: mongoose.Types.ObjectId | null;
  likeCount: number;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const experienceCommentSchema = new Schema<ExperienceCommentDocument>(
  {
    experienceId: {
      type: Schema.Types.ObjectId,
      ref: "Experience",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "ExperienceComment",
      default: null,
      index: true,
    },
    likeCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

experienceCommentSchema.index({ experienceId: 1, createdAt: -1 });
experienceCommentSchema.index({ experienceId: 1, parentId: 1, createdAt: 1 });

export const ExperienceComment = mongoose.model<ExperienceCommentDocument>(
  "ExperienceComment",
  experienceCommentSchema
);
