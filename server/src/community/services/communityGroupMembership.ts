import mongoose from "mongoose";
import { CommunityGroup } from "../models/CommunityGroup";
import {
  CommunityGroupMember,
  type CommunityGroupMemberRole,
} from "../models/CommunityGroupMember";

/**
 * Every read and write of group membership goes through here. The service used
 * to reach into `group.members` / `group.admins` in sixteen places; centralising
 * it means the denormalized `memberCount` on the group can only drift if this
 * file is wrong, rather than if any one of those sixteen forgot.
 */

const toObjectId = (value: string) => new mongoose.Types.ObjectId(value);

export const getMemberRole = async (
  groupId: string,
  userId: string,
): Promise<CommunityGroupMemberRole | null> => {
  const row = await CommunityGroupMember.findOne({ groupId, userId })
    .select("role")
    .lean();
  return (row?.role as CommunityGroupMemberRole) || null;
};

export const isGroupMember = async (
  groupId: string,
  userId: string,
): Promise<boolean> => Boolean(await getMemberRole(groupId, userId));

export const isGroupAdmin = async (
  groupId: string,
  userId: string,
): Promise<boolean> => (await getMemberRole(groupId, userId)) === "ADMIN";

export const listMemberIds = async (groupId: string): Promise<string[]> => {
  const rows = await CommunityGroupMember.find({ groupId })
    .select("userId")
    .sort({ createdAt: 1 })
    .lean();
  return rows.map((row) => String(row.userId));
};

export const listAdminIds = async (groupId: string): Promise<string[]> => {
  const rows = await CommunityGroupMember.find({ groupId, role: "ADMIN" })
    .select("userId")
    .lean();
  return rows.map((row) => String(row.userId));
};

export const countMembers = async (groupId: string): Promise<number> =>
  CommunityGroupMember.countDocuments({ groupId });

/**
 * One query answering "which of these groups is this user in, and where are
 * they an admin" — for list views that would otherwise issue a membership
 * lookup per row.
 */
export const membershipMapFor = async (
  userId: string | undefined,
  groupIds: string[],
): Promise<Map<string, CommunityGroupMemberRole>> => {
  if (!userId || groupIds.length === 0) {
    return new Map();
  }

  const rows = await CommunityGroupMember.find({
    userId,
    groupId: { $in: groupIds },
  })
    .select("groupId role")
    .lean();

  return new Map(
    rows.map((row) => [
      String(row.groupId),
      row.role as CommunityGroupMemberRole,
    ]),
  );
};

/** Group ids the user belongs to, newest membership first. */
export const listGroupIdsForUser = async (
  userId: string,
): Promise<string[]> => {
  const rows = await CommunityGroupMember.find({ userId })
    .select("groupId")
    .sort({ createdAt: -1 })
    .lean();
  return rows.map((row) => String(row.groupId));
};

/**
 * Adds a membership. Returns false when the user was already in the group, so
 * callers can skip the "welcome" notification on a repeat join.
 *
 * `memberCount` is only incremented when a row was actually inserted — the
 * unique index makes the insert the source of truth, so a double-tap cannot
 * inflate the counter.
 */
export const addMember = async (
  groupId: string,
  userId: string,
  role: CommunityGroupMemberRole = "MEMBER",
): Promise<boolean> => {
  const result = await CommunityGroupMember.updateOne(
    { groupId, userId },
    {
      $setOnInsert: {
        groupId: toObjectId(groupId),
        userId: toObjectId(userId),
        role,
      },
    },
    { upsert: true },
  );

  const inserted = Boolean(result.upsertedCount);
  if (inserted) {
    await CommunityGroup.updateOne(
      { _id: groupId },
      { $inc: { memberCount: 1 } },
    );
  }

  return inserted;
};

/** Removes a membership. Returns false when there was nothing to remove. */
export const removeMember = async (
  groupId: string,
  userId: string,
): Promise<boolean> => {
  const removed = await CommunityGroupMember.findOneAndDelete({
    groupId,
    userId,
  });

  if (!removed) {
    return false;
  }

  await CommunityGroup.updateOne(
    { _id: groupId },
    { $inc: { memberCount: -1 } },
  );

  return true;
};

export const setMemberRole = async (
  groupId: string,
  userId: string,
  role: CommunityGroupMemberRole,
): Promise<void> => {
  await CommunityGroupMember.updateOne({ groupId, userId }, { $set: { role } });
};

/**
 * Promotes the longest-standing member when a group loses its last admin.
 * Without this, everyone left in the group is locked out of settings, invites
 * and deletion with no way to recover.
 */
export const ensureGroupHasAdmin = async (groupId: string): Promise<void> => {
  const adminCount = await CommunityGroupMember.countDocuments({
    groupId,
    role: "ADMIN",
  });
  if (adminCount > 0) {
    return;
  }

  const fallback = await CommunityGroupMember.findOne({ groupId })
    .sort({ createdAt: 1 })
    .select("_id");

  if (fallback) {
    await CommunityGroupMember.updateOne(
      { _id: fallback._id },
      { $set: { role: "ADMIN" } },
    );
  }
};

/** Drops every membership for a group — used when the group itself is deleted. */
export const removeAllMembers = async (groupId: string): Promise<void> => {
  await CommunityGroupMember.deleteMany({ groupId });
};
