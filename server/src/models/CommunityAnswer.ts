import mongoose, { Document, Schema } from "mongoose";

export interface CommunityAnswerDocument extends Document {
  postId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const communityAnswerSchema = new Schema<CommunityAnswerDocument>(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityPost",
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
      minlength: 10,
      maxlength: 5000,
    },
    voteScore: { type: Number, default: 0, index: true },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

communityAnswerSchema.index({ postId: 1, createdAt: 1 });
communityAnswerSchema.index({ postId: 1, voteScore: -1, createdAt: -1 });

export const CommunityAnswer = mongoose.model<CommunityAnswerDocument>(
  "CommunityAnswer",
  communityAnswerSchema,
);
