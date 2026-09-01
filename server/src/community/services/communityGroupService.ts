import {
  CommunityConversation,
} from "../models/CommunityConversation";
import {
  CommunityGroup,
  type CommunityGroupVisibility,
} from "../models/CommunityGroup";
import {
  CommunityMessage,
} from "../models/CommunityMessage";
import {
  addMember,
  countMembers,
  ensureGroupHasAdmin,
  getMemberRole,
  isGroupAdmin,
  isGroupMember,
  listAdminIds,
  membershipMapFor,
  removeAllMembers,
  removeMember,
} from "./communityGroupMembership";
import {
  COMMUNITY_INTERACTION_POLICY,
  canJoinGroupAudience,
  isCrossRoleInteraction,
  type CommunityGroupAudience,
} from "./communityPolicy";
import {
  COMMUNITY_DEFAULT_GROUP_AUDIENCE,
  buildGroupParticipantKey,
  ensureCommunityUser,
  ensurePolicyAllowed,
  ensureProfile,
  escapeRegex,
  generateInviteCode,
  getCommunityRole,
  isBlockedBetween,
  normalizeOptionalText,
  resolveGroupPhotoUrl,
  resolvePublicViewerId,
  sendCommunityNotification,
  trackCommunityRoleMixEvent,
} from "./communityShared";
import mongoose from "mongoose";

/**
 * Groups: creation, settings, membership and invites.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityGroupService = {
  async listGroups(userId: string | undefined, query = "", limit = 20) {
    userId = await resolvePublicViewerId(userId);

    const normalizedQuery = query.trim();
    const safeLimit = Math.min(50, Math.max(1, limit));
    const regex = normalizedQuery
      ? new RegExp(escapeRegex(normalizedQuery), "i")
      : null;

    // PRIVATE groups are unlisted, so discovery only ever shows PUBLIC and
    // INVITE_ONLY. A private group the user is already in still reaches them
    // through their conversation list, which is keyed on membership.
    const discoverable = { $in: ["PUBLIC", "INVITE_ONLY"] };
    const filter = regex
      ? {
          visibility: discoverable,
          $or: [{ name: regex }, { sport: regex }, { city: regex }],
        }
      : { visibility: discoverable };

    const groups = await CommunityGroup.find(filter)
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    const membership = await membershipMapFor(
      userId,
      groups.map((group) => String(group._id)),
    );

    return Promise.all(
      groups.map(async (group) => {
        const role = membership.get(String(group._id));
        return {
          id: String(group._id),
          name: group.name,
          description: group.description || "",
          visibility: group.visibility,
          audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
          sport: group.sport || "",
          city: group.city || "",
          createdBy: String(group.createdBy),
          profilePicture: await resolveGroupPhotoUrl(group),
          memberCount: group.memberCount || 0,
          isMember: Boolean(role),
          isAdmin: role === "ADMIN",
          isOwner: userId ? String(group.createdBy) === userId : false,
          memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
        };
      }),
    );
  },

  async createGroup(
    userId: string,
    payload: {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
      profilePicture?: string;
      profilePictureKey?: string;
      audience?: CommunityGroupAudience;
      visibility?: CommunityGroupVisibility;
    },
  ) {
    await ensureProfile(userId);

    const creatorRole = await getCommunityRole(userId);

    const name = payload.name.trim();
    if (!name) {
      throw new Error("Group name is required");
    }

    const group = await CommunityGroup.findOneAndUpdate(
      { createdBy: new mongoose.Types.ObjectId(userId), name },
      {
        $setOnInsert: {
          name,
          description: normalizeOptionalText(payload.description),
          sport: payload.sport || "",
          city: payload.city || "",
          profilePicture: payload.profilePicture || "",
          profilePictureKey: payload.profilePictureKey || "",
          visibility: payload.visibility || "PUBLIC",
          memberAddPolicy: "ADMIN_ONLY",
          audience: payload.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
          createdBy: new mongoose.Types.ObjectId(userId),
          memberCount: 0,
          inviteCode: generateInviteCode(),
        },
      },
      { upsert: true, new: true },
    );

    // The creator is the first member and its first admin. `addMember` is a
    // no-op on the upsert path where the group already existed, so re-creating
    // a group by the same name does not double-count them.
    await addMember(String(group._id), userId, "ADMIN");

    trackCommunityRoleMixEvent("group_created", {
      groupId: String(group._id),
      createdByRole: creatorRole,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
    });

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          participantKey: buildGroupParticipantKey(String(group._id)),
          participants: [new mongoose.Types.ObjectId(userId)],
          status: "ACTIVE",
          requestedBy: new mongoose.Types.ObjectId(userId),
          lastMessageAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    return {
      id: String(group._id),
      name: group.name,
      description: group.description || "",
      visibility: group.visibility,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
      sport: group.sport || "",
      city: group.city || "",
      createdBy: String(group.createdBy),
      profilePicture: await resolveGroupPhotoUrl(group),
      memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      memberCount: await countMembers(String(group._id)),
      isMember: true,
      isAdmin: true,
      isOwner: true,
      conversationId: String(conversation._id),
    };
  },

  async updateGroup(
    userId: string,
    groupId: string,
    payload: {
      name?: string;
      description?: string;
      sport?: string;
      city?: string;
      profilePicture?: string;
      profilePictureKey?: string;
      audience?: CommunityGroupAudience;
      visibility?: CommunityGroupVisibility;
    },
  ) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupAdmin(groupId, userId))) {
      throw new Error("Only group admins can update the group");
    }

    if (payload.name) group.name = payload.name;
    if (typeof payload.description === "string") group.description = payload.description;
    if (typeof payload.sport === "string") group.sport = payload.sport;
    if (typeof payload.city === "string") group.city = payload.city;
    if (typeof payload.profilePicture === "string") group.profilePicture = payload.profilePicture;
    if (typeof payload.profilePictureKey === "string") group.profilePictureKey = payload.profilePictureKey;
    if (payload.audience) group.audience = payload.audience;
    if (payload.visibility) group.visibility = payload.visibility;

    await group.save();

    const [memberCount, role] = await Promise.all([
      countMembers(groupId),
      getMemberRole(groupId, userId),
    ]);

    return {
      id: String(group._id),
      groupId: String(group._id),
      name: group.name,
      description: group.description || "",
      visibility: group.visibility,
      audience: group.audience || COMMUNITY_DEFAULT_GROUP_AUDIENCE,
      sport: group.sport || "",
      city: group.city || "",
      createdBy: String(group.createdBy),
      profilePicture: await resolveGroupPhotoUrl(group),
      memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      memberCount,
      isMember: Boolean(role),
      isAdmin: role === "ADMIN",
      isOwner: String(group.createdBy) === userId,
    };
  },

  async updateGroupSettings(
    userId: string,
    groupId: string,
    payload: {
      memberAddPolicy?: "ADMIN_ONLY" | "ANY_MEMBER";
      postPolicy?: "ANY_MEMBER" | "ADMIN_ONLY";
    },
  ) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupAdmin(groupId, userId))) {
      throw new Error("Only group admins can update settings");
    }

    if (payload.memberAddPolicy) {
      group.memberAddPolicy = payload.memberAddPolicy;
    }
    if (payload.postPolicy) {
      group.postPolicy = payload.postPolicy;
    }
    await group.save();

    return {
      groupId: String(group._id),
      memberAddPolicy: group.memberAddPolicy,
    };
  },

  async joinGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const userRole = await getCommunityRole(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const groupAudience =
      (group.audience as CommunityGroupAudience | undefined) ||
      COMMUNITY_DEFAULT_GROUP_AUDIENCE;
    if (!canJoinGroupAudience(groupAudience, userRole)) {
      throw new Error("This group is not available for your role");
    }

    // Self-service joining is a PUBLIC-only affair. INVITE_ONLY groups are
    // discoverable so they can be found and asked about, but getting in still
    // needs a code or an admin; PRIVATE ones are not listed at all.
    const alreadyMember = await isGroupMember(groupId, userId);
    if (!alreadyMember && group.visibility !== "PUBLIC") {
      throw new Error(
        "This group is invite-only. Ask an admin for an invite link.",
      );
    }

    if (!alreadyMember) {
      await addMember(groupId, userId);

      trackCommunityRoleMixEvent("group_joined", {
        groupId,
        audience: groupAudience,
        role: userRole,
      });
    }

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          participantKey: buildGroupParticipantKey(String(group._id)),
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
        },
        $addToSet: {
          participants: new mongoose.Types.ObjectId(userId),
        },
      },
      { upsert: true, new: true },
    );

    if (!alreadyMember) {
      const adminIds = (await listAdminIds(groupId)).filter(
        (adminId) => adminId !== userId,
      );

      for (const adminId of adminIds) {
        sendCommunityNotification(
          adminId,
          "New group member",
          `A new member joined ${group.name}.`,
          {
            event: "COMMUNITY_GROUP_JOINED",
            groupId: String(group._id),
            conversationId: String(conversation?._id || ""),
            actorUserId: userId,
          },
        );
      }
    }

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: await countMembers(groupId),
    };
  },

  async deleteGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const isCreator = String(group.createdBy) === userId;
    const isAdmin = await isGroupAdmin(groupId, userId);

    if (!isCreator && !isAdmin) {
      throw new Error("Only group admins can delete the group");
    }

    const groupConversation = await CommunityConversation.findOne({
      conversationType: "GROUP",
      groupId: group._id,
    });

    if (groupConversation) {
      await Promise.all([
        CommunityMessage.deleteMany({
          conversationId: groupConversation._id,
        }),
        CommunityConversation.deleteOne({ _id: groupConversation._id }),
      ]);
    }

    await Promise.all([
      CommunityGroup.deleteOne({ _id: group._id }),
      removeAllMembers(groupId),
    ]);

    return { groupId: String(group._id), deletedGroup: true };
  },

  async leaveGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const wasMember = await removeMember(groupId, userId);
    if (!wasMember) {
      return { groupId, removed: false };
    }

    // Promote someone if that was the last admin, or everyone still in the
    // group is locked out of settings, invites and deletion.
    await ensureGroupHasAdmin(groupId);
    const remainingMembers = await countMembers(groupId);

    const groupConversation = await CommunityConversation.findOne({
      conversationType: "GROUP",
      groupId: group._id,
    });

    if (groupConversation) {
      groupConversation.participants = groupConversation.participants.filter(
        (participantId) => String(participantId) !== userId,
      );

      if (!groupConversation.participants.length || remainingMembers === 0) {
        await Promise.all([
          CommunityMessage.deleteMany({
            conversationId: groupConversation._id,
          }),
          CommunityConversation.deleteOne({ _id: groupConversation._id }),
        ]);
      } else {
        await groupConversation.save();
      }
    }

    if (remainingMembers === 0) {
      await Promise.all([
        CommunityGroup.deleteOne({ _id: group._id }),
        removeAllMembers(groupId),
      ]);
      return { groupId: String(group._id), removed: true, deletedGroup: true };
    }

    const remainingAdminIds = (await listAdminIds(groupId)).filter(
      (adminId) => adminId !== userId,
    );

    for (const adminId of remainingAdminIds) {
      sendCommunityNotification(
        adminId,
        "Member left group",
        `A member left ${group.name}.`,
        {
          event: "COMMUNITY_GROUP_LEFT",
          groupId: String(group._id),
          actorUserId: userId,
        },
      );
    }

    return { groupId: String(group._id), removed: true, deletedGroup: false };
  },

  async addGroupMember(userId: string, groupId: string, targetUserId: string) {
    await Promise.all([
      ensureProfile(userId),
      ensureCommunityUser(targetUserId),
    ]);

    if (userId === targetUserId) {
      throw new Error("Use join group to add yourself");
    }

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const [requesterRole, targetRole] = await Promise.all([
      getCommunityRole(userId),
      getCommunityRole(targetUserId),
    ]);

    const groupAudience =
      (group.audience as CommunityGroupAudience | undefined) ||
      COMMUNITY_DEFAULT_GROUP_AUDIENCE;
    if (!canJoinGroupAudience(groupAudience, targetRole)) {
      throw new Error("This group is not available for the selected user role");
    }

    if (isCrossRoleInteraction(requesterRole, targetRole)) {
      ensurePolicyAllowed(
        COMMUNITY_INTERACTION_POLICY.allowCrossRoleGroupMembership,
        "Cross-role group membership is currently disabled",
      );
      trackCommunityRoleMixEvent("group_cross_role_invite", {
        groupId,
        audience: groupAudience,
        requesterRole,
        targetRole,
      });
    }

    const requesterRoleInGroup = await getMemberRole(groupId, userId);
    const requesterIsAdmin = requesterRoleInGroup === "ADMIN";
    if (!requesterRoleInGroup) {
      throw new Error("Only group members can add members");
    }

    const memberAddPolicy = group.memberAddPolicy || "ADMIN_ONLY";
    if (memberAddPolicy === "ADMIN_ONLY" && !requesterIsAdmin) {
      throw new Error("Only group admins can add members");
    }

    const blocked = await isBlockedBetween(userId, targetUserId);
    if (blocked) {
      throw new Error("Cannot add this user due to privacy settings");
    }

    // `addMember` reports whether a row was actually inserted, so this stays
    // correct if two admins add the same person at once.
    const added = await addMember(groupId, targetUserId);
    const alreadyMember = !added;

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          participantKey: buildGroupParticipantKey(String(group._id)),
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
        },
        $addToSet: {
          participants: new mongoose.Types.ObjectId(targetUserId),
        },
      },
      { upsert: true, new: true },
    );

    if (!alreadyMember && targetUserId !== userId) {
      sendCommunityNotification(
        targetUserId,
        "You were added to a group",
        `${group.name} added you to the community discussion.`,
        {
          event: "COMMUNITY_GROUP_MEMBER_ADDED",
          groupId: String(group._id),
          conversationId: String(conversation?._id || ""),
          actorUserId: userId,
        },
      );
    }

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: await countMembers(groupId),
      addedUserId: targetUserId,
      alreadyMember,
    };
  },
};
