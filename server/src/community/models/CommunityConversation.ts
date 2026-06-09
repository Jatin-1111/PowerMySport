import mongoose, { Document, Schema } from "mongoose";

export type CommunityConversationStatus = "PENDING" | "ACTIVE";
export type CommunityConversationType = "DM" | "GROUP";

export interface CommunityConversationDocument extends Document {
  participants: mongoose.Types.ObjectId[];
  participantKey?: string;
  conversationType: CommunityConversationType;
  groupId?: mongoose.Types.ObjectId;
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
    conversationType: {
      type: String,
      enum: ["DM", "GROUP"],
      default: "DM",
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityGroup",
      index: true,
    },
    participantKey: {
      type: String,
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
communityConversationSchema.index({ groupId: 1, updatedAt: -1 });
communityConversationSchema.index(
  { participantKey: 1 },
  {
    unique: true,
    name: "participantKey_dm_unique",
    partialFilterExpression: {
      conversationType: "DM",
      participantKey: { $type: "string" },
    },
  },
);

export const CommunityConversation =
  mongoose.model<CommunityConversationDocument>(
    "CommunityConversation",
    communityConversationSchema,
  );
