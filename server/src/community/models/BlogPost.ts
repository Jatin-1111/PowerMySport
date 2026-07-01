import mongoose, { Document, Schema } from "mongoose";

export type BlogPostStatus = "PUBLISHED" | "DRAFT";

export type BlogBlockType =
  | "heading"
  | "text"
  | "list"
  | "image"
  | "quote";

/**
 * A single content block in a blog body. Blocks are stored as loosely typed
 * objects so the block editor can evolve without a schema migration. Common
 * shapes:
 *  - heading: { id, type: "heading", text, level? }
 *  - text:    { id, type: "text", text }
 *  - quote:   { id, type: "quote", text }
 *  - list:    { id, type: "list", items: string[], ordered?: boolean }
 *  - image:   { id, type: "image", imageKey?, imageUrl?, caption? }
 */
export interface BlogBlock {
  id: string;
  type: BlogBlockType;
  [key: string]: unknown;
}

export interface BlogPostDocument extends Document {
  authorId: mongoose.Types.ObjectId;
  title: string;
  excerpt: string;
  coverImageKey?: string | null;
  coverImageUrl?: string | null;
  topic: string;
  tags: string[];
  content: BlogBlock[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  status: BlogPostStatus;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<BlogPostDocument>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
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
    topic: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "General",
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 8,
        message: "A blog can have at most 8 tags",
      },
    },
    content: {
      // Loosely-typed block array; the block editor evolves without migrations.
      type: [Schema.Types.Mixed],
      default: [],
    } as never,
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
  { timestamps: true },
);

blogPostSchema.index({ createdAt: -1 });
blogPostSchema.index({ topic: 1, createdAt: -1 });
blogPostSchema.index({ authorId: 1, createdAt: -1 });
blogPostSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
blogPostSchema.index({ title: "text", excerpt: "text", tags: "text" });

export const BlogPost = mongoose.model<BlogPostDocument>(
  "BlogPost",
  blogPostSchema,
);
