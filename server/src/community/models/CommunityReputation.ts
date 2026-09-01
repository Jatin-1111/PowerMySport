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

// Direction matters: listLeaderboard sorts { totalPoints: -1, updatedAt: 1 }.
// A compound index only serves a sort whose directions match it exactly or
// are its exact reverse on every field — { -1, -1 } satisfies neither, so
// this must mirror the query's directions, not just its field order.
// Production has autoIndex off (see config/database.ts), so the corrected
// index also needs migration 32.
communityReputationSchema.index({ totalPoints: -1, updatedAt: 1 });

export const CommunityReputation = mongoose.model<CommunityReputationDocument>(
  "CommunityReputation",
  communityReputationSchema,
);
