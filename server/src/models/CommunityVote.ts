import mongoose, { Document, Schema } from "mongoose";

export type CommunityVoteTargetType = "POST" | "ANSWER";

export interface CommunityVoteDocument extends Document {
  userId: mongoose.Types.ObjectId;
  targetType: CommunityVoteTargetType;
  targetId: mongoose.Types.ObjectId;
  value: 1 | -1;
  createdAt: Date;
  updatedAt: Date;
}

const communityVoteSchema = new Schema<CommunityVoteDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["POST", "ANSWER"],
      required: true,
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    value: {
      type: Number,
      enum: [1, -1],
      required: true,
    },
  },
  { timestamps: true },
);

communityVoteSchema.index(
  { userId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
communityVoteSchema.index({ targetType: 1, targetId: 1 });

export const CommunityVote = mongoose.model<CommunityVoteDocument>(
  "CommunityVote",
  communityVoteSchema,
);
