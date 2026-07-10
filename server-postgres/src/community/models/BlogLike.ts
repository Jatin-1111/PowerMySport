import mongoose, { Document, Schema } from "mongoose";

export type BlogLikeTargetType = "BLOG" | "COMMENT";

export interface BlogLikeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  targetType: BlogLikeTargetType;
  targetId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const blogLikeSchema = new Schema<BlogLikeDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["BLOG", "COMMENT"],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

blogLikeSchema.index(
  { userId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
blogLikeSchema.index({ targetType: 1, targetId: 1 });

export const BlogLike = mongoose.model<BlogLikeDocument>(
  "BlogLike",
  blogLikeSchema,
);
