import mongoose, { Document, Schema } from "mongoose";

export type CommunityConversationStatus = "PENDING" | "ACTIVE";

export interface CommunityConversationDocument extends Document {
  participants: mongoose.Types.ObjectId[];
  participantKey: string;
  status: CommunityConversationStatus;
  requestedBy: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const communityConversationSchema = new Schema<CommunityConversationDocument>(
  {
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE"],
      default: "ACTIVE",
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

communityConversationSchema.index({ participants: 1, updatedAt: -1 });

export const CommunityConversation =
  mongoose.model<CommunityConversationDocument>(
    "CommunityConversation",
    communityConversationSchema,
  );
