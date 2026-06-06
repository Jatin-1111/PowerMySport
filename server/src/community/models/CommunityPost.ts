import mongoose, { Document, Schema } from "mongoose";

export type CommunityPostStatus = "OPEN" | "CLOSED";

export interface CommunityPostDocument extends Document {
  authorId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  tags: string[];
  sport?: string;
  city?: string;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  answerCount: number;
  viewCount: number;
  status: CommunityPostStatus;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const communityPostSchema = new Schema<CommunityPostDocument>(
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
      minlength: 10,
      maxlength: 180,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 5000,
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 8,
        message: "A post can have at most 8 tags",
      },
    },
    sport: { type: String, trim: true, maxlength: 60, default: "" },
    city: { type: String, trim: true, maxlength: 80, default: "" },
    voteScore: { type: Number, default: 0, index: true },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    answerCount: { type: Number, default: 0, index: true },
    viewCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

communityPostSchema.index({ createdAt: -1 });
communityPostSchema.index({ voteScore: -1, createdAt: -1 });
communityPostSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
communityPostSchema.index({ tags: 1, createdAt: -1 });
communityPostSchema.index({ title: "text", body: "text", tags: "text" });

export const CommunityPost = mongoose.model<CommunityPostDocument>(
  "CommunityPost",
  communityPostSchema,
);
