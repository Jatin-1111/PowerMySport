import mongoose, { Document, Schema } from "mongoose";

export type CommunityMessagePrivacy = "EVERYONE" | "REQUEST_ONLY" | "NONE";

export interface CommunityProfileDocument extends Document {
  userId: mongoose.Types.ObjectId;
  anonymousAlias: string;
  isIdentityPublic: boolean;
  messagePrivacy: CommunityMessagePrivacy;
  readReceiptsEnabled: boolean;
  lastSeenVisible: boolean;
  blockedUsers: mongoose.Types.ObjectId[];
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const communityProfileSchema = new Schema<CommunityProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    anonymousAlias: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 40,
    },
    isIdentityPublic: {
      type: Boolean,
      default: false,
    },
    messagePrivacy: {
      type: String,
      enum: ["EVERYONE", "REQUEST_ONLY", "NONE"],
      default: "EVERYONE",
    },
    readReceiptsEnabled: {
      type: Boolean,
      default: true,
    },
    lastSeenVisible: {
      type: Boolean,
      default: true,
    },
    blockedUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastSeenAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

export const CommunityProfile = mongoose.model<CommunityProfileDocument>(
  "CommunityProfile",
  communityProfileSchema,
);
