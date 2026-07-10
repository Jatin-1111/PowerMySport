import mongoose, { Document, Schema } from "mongoose";

export interface CommunityReputationDocument extends Document {
  userId: mongoose.Types.ObjectId;
  totalPoints: number;
  questionCount: number;
  answerCount: number;
  receivedUpvotes: number;
  createdAt: Date;
  updatedAt: Date;
}

const communityReputationSchema = new Schema<CommunityReputationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    totalPoints: { type: Number, default: 0, index: true },
    questionCount: { type: Number, default: 0 },
    answerCount: { type: Number, default: 0 },
    receivedUpvotes: { type: Number, default: 0 },
  },
  { timestamps: true },
);

communityReputationSchema.index({ totalPoints: -1, updatedAt: -1 });

export const CommunityReputation = mongoose.model<CommunityReputationDocument>(
  "CommunityReputation",
  communityReputationSchema,
);
