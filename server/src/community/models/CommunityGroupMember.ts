import mongoose, { Document, Schema } from "mongoose";

export type CommunityGroupMemberRole = "ADMIN" | "MEMBER";

export interface CommunityGroupMemberDocument extends Document {
  groupId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: CommunityGroupMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Group membership used to be two arrays embedded on the group document
 * (`members` and `admins`). That capped a group at whatever fits in one 16MB
 * BSON document, made every join a read-modify-write of the whole array, and
 * meant two people joining at once could clobber each other. One row per
 * membership removes all three problems and lets "which groups am I in" be an
 * indexed query rather than a scan over every group.
 */
const communityGroupMemberSchema = new Schema<CommunityGroupMemberDocument>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "CommunityGroup",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["ADMIN", "MEMBER"],
      default: "MEMBER",
      required: true,
    },
  },
  { timestamps: true }
);

// Joining twice is a no-op, not a duplicate row. Every add relies on this.
communityGroupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

// "Who is in this group", and the admin-only subset for permission checks.
communityGroupMemberSchema.index({ groupId: 1, role: 1 });

// "Which groups is this user in", for the conversation list and discovery.
communityGroupMemberSchema.index({ userId: 1, createdAt: -1 });

// Backs the paginated member-list sort ({ groupId } filter, createdAt order).
// Production has autoIndex off, so this also needs migration 31.
communityGroupMemberSchema.index({ groupId: 1, createdAt: 1 });

export const CommunityGroupMember = mongoose.model<CommunityGroupMemberDocument>(
  "CommunityGroupMember",
  communityGroupMemberSchema
);
