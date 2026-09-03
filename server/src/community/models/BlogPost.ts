import mongoose, { Document, Schema } from "mongoose";

export type BlogPostStatus = "PUBLISHED" | "DRAFT";

export interface BlogPostDocument extends Document {
  authorId: mongoose.Types.ObjectId;
  title: string;
  excerpt: string;
  coverImageKey?: string | null;
  coverImageUrl?: string | null;
  topic: string;
  tags: string[];
  /** Rich-text HTML produced by the Tiptap editor; sanitized on render. */
  content: string;
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
      type: String,
      default: "",
      maxlength: 100_000,
    },
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

blogPostSchema.index({ createdAt: -1 });
blogPostSchema.index({ topic: 1, createdAt: -1 });
blogPostSchema.index({ authorId: 1, createdAt: -1 });
blogPostSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
// The article body was missing here, so searching for a phrase that appears in
// a post found nothing unless it also happened to be in the title or excerpt.
//
// MongoDB allows only ONE text index per collection, so this cannot simply be
// edited in place on a live database: Mongoose will try to build it alongside
// the old one and MongoDB rejects the conflict. Migration 27 drops the old
// index and builds this one. The explicit name is what lets the migration
// recognise its own work on a re-run.
blogPostSchema.index(
  { title: "text", excerpt: "text", tags: "text", content: "text" },
  {
    name: "blog_search_v2",
    weights: { title: 10, tags: 6, excerpt: 4, content: 1 },
  }
);

export const BlogPost = mongoose.model<BlogPostDocument>("BlogPost", blogPostSchema);
