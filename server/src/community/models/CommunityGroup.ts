import mongoose, { Document, Schema } from "mongoose";
import { emitCommunityGroupEvent } from "../services/CommunityRealtimeService";

/**
 * PUBLIC      — listed in discovery, anyone eligible can join themselves.
 * INVITE_ONLY — listed in discovery so it can be found, but joining requires an
 *               invite code or an admin adding you.
 * PRIVATE     — not listed at all; invite code or admin-add only.
 */
export type CommunityGroupVisibility = "PUBLIC" | "INVITE_ONLY" | "PRIVATE";
export type CommunityGroupMemberAddPolicy = "ADMIN_ONLY" | "ANY_MEMBER";
export type CommunityGroupAudience = "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY";

export interface CommunityGroupDocument extends Document {
  name: string;
  description?: string;
  visibility: CommunityGroupVisibility;
  sport?: string;
  city?: string;
  profilePicture?: string;
  profilePictureKey?: string;
  memberAddPolicy: CommunityGroupMemberAddPolicy;
  audience: CommunityGroupAudience;
  createdBy: mongoose.Types.ObjectId;
  /** Denormalized count of CommunityGroupMember rows — see the note on the
   *  field below. Membership itself lives in that collection. */
  memberCount: number;
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
      enum: ["PUBLIC", "INVITE_ONLY", "PRIVATE"],
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
    profilePicture: {
      type: String,
      default: "",
    },
    profilePictureKey: {
      type: String,
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
    // Maintained exclusively by communityGroupMembership.ts alongside the
    // CommunityGroupMember rows it counts. Denormalized because discovery and
    // the conversation list render up to 50 groups at a time and a per-row
    // count query there is 50 round-trips for a number that changes rarely.
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
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
communityGroupSchema.index({ inviteCode: 1 });

const notifyGroupMembersUpdated = (doc: any) => {
  if (!doc || !doc._id) return;
  emitCommunityGroupEvent(doc._id.toString(), "community:groupMembersUpdated", {
    groupId: doc._id.toString(),
  });
};

communityGroupSchema.post("save", function (doc) {
  notifyGroupMembersUpdated(doc);
});

communityGroupSchema.post("findOneAndUpdate", function (doc) {
  notifyGroupMembersUpdated(doc);
});

export const CommunityGroup = mongoose.model<CommunityGroupDocument>(
  "CommunityGroup",
  communityGroupSchema,
);
