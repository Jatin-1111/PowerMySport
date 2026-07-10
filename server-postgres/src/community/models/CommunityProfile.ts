import mongoose, { Document, Schema } from "mongoose";

export type CommunityMessagePrivacy = "EVERYONE" | "REQUEST_ONLY" | "NONE";

export interface CommunitySocialLinks {
  youtube?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

export interface CommunityProfileDocument extends Document {
  userId: mongoose.Types.ObjectId;
  anonymousAlias: string;
  isIdentityPublic: boolean;
  messagePrivacy: CommunityMessagePrivacy;
  readReceiptsEnabled: boolean;
  lastSeenVisible: boolean;
  blockedUsers: mongoose.Types.ObjectId[];
  lastSeenAt?: Date;
  /** Public @handle used by the blog feature. Auto-generated, user-editable. */
  username?: string;
  bio?: string;
  socialLinks?: CommunitySocialLinks;
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
      default: true,
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
    username: {
      type: String,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
      unique: true,
      sparse: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    socialLinks: {
      youtube: { type: String, trim: true, maxlength: 200, default: "" },
      instagram: { type: String, trim: true, maxlength: 200, default: "" },
      facebook: { type: String, trim: true, maxlength: 200, default: "" },
      twitter: { type: String, trim: true, maxlength: 200, default: "" },
      github: { type: String, trim: true, maxlength: 200, default: "" },
      website: { type: String, trim: true, maxlength: 200, default: "" },
    },
  },
  { timestamps: true },
);

export const CommunityProfile = mongoose.model<CommunityProfileDocument>(
  "CommunityProfile",
  communityProfileSchema,
);
