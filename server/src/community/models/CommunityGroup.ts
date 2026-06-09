import mongoose, { Document, Schema } from "mongoose";

export type CommunityGroupVisibility = "PUBLIC";
export type CommunityGroupMemberAddPolicy = "ADMIN_ONLY" | "ANY_MEMBER";
export type CommunityGroupAudience = "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY";

export interface CommunityGroupDocument extends Document {
  name: string;
  description?: string;
  visibility: CommunityGroupVisibility;
  sport?: string;
  city?: string;
  memberAddPolicy: CommunityGroupMemberAddPolicy;
  audience: CommunityGroupAudience;
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const communityGroupSchema = new Schema<CommunityGroupDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    visibility: {
      type: String,
      enum: ["PUBLIC"],
      default: "PUBLIC",
      index: true,
    },
    sport: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    memberAddPolicy: {
      type: String,
      enum: ["ADMIN_ONLY", "ANY_MEMBER"],
      default: "ADMIN_ONLY",
    },
    audience: {
      type: String,
      enum: ["ALL", "PLAYERS_ONLY", "COACHES_ONLY"],
      default: "ALL",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 20,
    },
  },
  { timestamps: true },
);

communityGroupSchema.index({ visibility: 1, updatedAt: -1 });
communityGroupSchema.index({ members: 1, updatedAt: -1 });
communityGroupSchema.index({ inviteCode: 1 });

export const CommunityGroup = mongoose.model<CommunityGroupDocument>(
  "CommunityGroup",
  communityGroupSchema,
);
