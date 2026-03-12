import mongoose from "mongoose";
import {
  CommunityConversation,
  CommunityConversationDocument,
} from "../models/CommunityConversation";
import { CommunityGroup } from "../models/CommunityGroup";
import { CommunityMessage } from "../models/CommunityMessage";
import {
  CommunityMessagePrivacy,
  CommunityProfile,
} from "../models/CommunityProfile";
import { User } from "../models/User";
import { CommunityReport } from "../models/CommunityReport";

const buildParticipantKey = (a: string, b: string): string =>
  [a, b].sort().join(":");

const normalizeOptionalText = (value?: string): string => value?.trim() || "";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const makeDefaultAlias = (name?: string): string => {
  const seed = Math.floor(1000 + Math.random() * 9000);
  const safeName = name?.trim().split(" ")[0] || "Player";
  return `${safeName}-${seed}`;
};

const ensurePlayerUser = async (userId: string) => {
  const user = await User.findById(userId).select("_id role name").lean();
  if (!user) {
    throw new Error("User not found");
  }

  if (user.role !== "PLAYER") {
    throw new Error("Only players can use community chat");
  }

  return user;
};

const ensureProfile = async (userId: string) => {
  const user = await ensurePlayerUser(userId);
  let profile = await CommunityProfile.findOne({ userId });
  if (!profile) {
    profile = await CommunityProfile.create({
      userId,
      anonymousAlias: makeDefaultAlias(user.name),
    });
  }

  return profile;
};

const isBlockedBetween = async (
  userA: string,
  userB: string,
): Promise<boolean> => {
  const [a, b] = await Promise.all([
    CommunityProfile.findOne({ userId: userA }).select("blockedUsers"),
    CommunityProfile.findOne({ userId: userB }).select("blockedUsers"),
  ]);

  const aBlockedB = Boolean(
    a?.blockedUsers?.some((blocked) => String(blocked) === userB),
  );
  const bBlockedA = Boolean(
    b?.blockedUsers?.some((blocked) => String(blocked) === userA),
  );

  return aBlockedB || bBlockedA;
};

const formatParticipant = (
  selfId: string,
  participant: {
    _id: mongoose.Types.ObjectId;
    name: string;
    photoUrl?: string;
    profile?: {
      anonymousAlias: string;
      isIdentityPublic: boolean;
      lastSeenVisible: boolean;
      lastSeenAt?: Date;
    };
  },
) => {
  const profile = participant.profile;
  const isSelf = String(participant._id) === selfId;

  return {
    id: String(participant._id),
    displayName: isSelf
      ? participant.name
      : profile?.isIdentityPublic
        ? participant.name
        : profile?.anonymousAlias || "Anonymous Player",
    isIdentityPublic: profile?.isIdentityPublic || false,
    photoUrl:
      !isSelf && profile?.isIdentityPublic ? participant.photoUrl : null,
    lastSeenAt: profile?.lastSeenVisible ? profile?.lastSeenAt || null : null,
  };
};

export const CommunityService = {
  async searchPlayers(userId: string, query: string, limit = 10) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return [];
    }

    const safeLimit = Math.min(20, Math.max(1, limit));
    const profile = await ensureProfile(userId);
    const regex = new RegExp(escapeRegex(normalizedQuery), "i");

    const [nameMatches, aliasMatches] = await Promise.all([
      User.find({ role: "PLAYER", name: regex, _id: { $ne: userId } })
        .select("_id name photoUrl")
        .limit(safeLimit * 3)
        .lean(),
      CommunityProfile.find({ anonymousAlias: regex, userId: { $ne: userId } })
        .select("userId")
        .limit(safeLimit * 3)
        .lean(),
    ]);

    const candidateIds = new Set<string>();
    for (const user of nameMatches) {
      candidateIds.add(String(user._id));
    }
    for (const match of aliasMatches) {
      candidateIds.add(String(match.userId));
    }

    const ids = Array.from(candidateIds);
    if (!ids.length) {
      return [];
    }

    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: ids }, role: "PLAYER" })
        .select("_id name photoUrl")
        .lean(),
      CommunityProfile.find({ userId: { $in: ids } })
        .select("userId anonymousAlias isIdentityPublic blockedUsers")
        .lean(),
    ]);

    const blockedByMe = new Set(profile.blockedUsers.map((id) => String(id)));
    const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

    const items = users
      .filter((user) => {
        const candidateId = String(user._id);
        if (blockedByMe.has(candidateId)) {
          return false;
        }

        const candidateProfile = profileMap.get(candidateId);
        const blockedMe = Boolean(
          candidateProfile?.blockedUsers?.some(
            (blockedUserId) => String(blockedUserId) === userId,
          ),
        );

        return !blockedMe;
      })
      .map((user) => {
        const candidateId = String(user._id);
        const candidateProfile = profileMap.get(candidateId);
        const isIdentityPublic = candidateProfile?.isIdentityPublic || false;
        const displayName = isIdentityPublic
          ? user.name
          : candidateProfile?.anonymousAlias || "Anonymous Player";

        return {
          id: candidateId,
          displayName,
          isIdentityPublic,
          photoUrl: isIdentityPublic ? user.photoUrl || null : null,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, safeLimit);

    return items;
  },

  async getMyProfile(userId: string) {
    const profile = await ensureProfile(userId);
    return profile.toObject();
  },

  async updateMyProfile(
    userId: string,
    payload: {
      isIdentityPublic?: boolean;
      messagePrivacy?: CommunityMessagePrivacy;
      readReceiptsEnabled?: boolean;
      lastSeenVisible?: boolean;
      anonymousAlias?: string;
    },
  ) {
    const profile = await ensureProfile(userId);

    if (typeof payload.isIdentityPublic === "boolean") {
      profile.isIdentityPublic = payload.isIdentityPublic;
    }

    if (payload.messagePrivacy) {
      profile.messagePrivacy = payload.messagePrivacy;
    }

    if (typeof payload.readReceiptsEnabled === "boolean") {
      profile.readReceiptsEnabled = payload.readReceiptsEnabled;
    }

    if (typeof payload.lastSeenVisible === "boolean") {
      profile.lastSeenVisible = payload.lastSeenVisible;
    }

    if (payload.anonymousAlias?.trim()) {
      profile.anonymousAlias = payload.anonymousAlias.trim();
    }

    await profile.save();
    return profile.toObject();
  },

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error("You cannot block yourself");
    }

    await Promise.all([ensureProfile(userId), ensurePlayerUser(targetUserId)]);

    await CommunityProfile.updateOne(
      { userId },
      { $addToSet: { blockedUsers: targetUserId } },
    );

    return { blockedUserId: targetUserId };
  },

  async unblockUser(userId: string, targetUserId: string) {
    await ensureProfile(userId);

    await CommunityProfile.updateOne(
      { userId },
      { $pull: { blockedUsers: targetUserId } },
    );

    return { unblockedUserId: targetUserId };
  },

  async getBlockedUsers(userId: string) {
    const profile = await ensureProfile(userId);
    const users = await User.find({ _id: { $in: profile.blockedUsers } })
      .select("_id name photoUrl")
      .lean();

    return users.map((user) => ({
      id: String(user._id),
      name: user.name,
      photoUrl: user.photoUrl || null,
    }));
  },

  async listGroups(userId: string, query = "", limit = 20) {
    await ensureProfile(userId);

    const normalizedQuery = query.trim();
    const safeLimit = Math.min(50, Math.max(1, limit));
    const regex = normalizedQuery
      ? new RegExp(escapeRegex(normalizedQuery), "i")
      : null;

    const filter = regex
      ? {
          visibility: "PUBLIC",
          $or: [{ name: regex }, { sport: regex }, { city: regex }],
        }
      : { visibility: "PUBLIC" };

    const groups = await CommunityGroup.find(filter)
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    return groups.map((group) => {
      const memberIds = group.members.map((memberId) => String(memberId));
      const adminIds = group.admins.map((adminId) => String(adminId));
      return {
        id: String(group._id),
        name: group.name,
        description: group.description || "",
        visibility: group.visibility,
        sport: group.sport || "",
        city: group.city || "",
        createdBy: String(group.createdBy),
        memberCount: memberIds.length,
        isMember: memberIds.includes(userId),
        isAdmin: adminIds.includes(userId),
        memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      };
    });
  },

  async createGroup(
    userId: string,
    payload: {
      name: string;
      description?: string;
      sport?: string;
      city?: string;
    },
  ) {
    await ensureProfile(userId);

    const name = payload.name.trim();
    if (!name) {
      throw new Error("Group name is required");
    }

    const group = await CommunityGroup.create({
      name,
      description: normalizeOptionalText(payload.description),
      sport: normalizeOptionalText(payload.sport),
      city: normalizeOptionalText(payload.city),
      visibility: "PUBLIC",
      memberAddPolicy: "ADMIN_ONLY",
      createdBy: userId,
      members: [userId],
      admins: [userId],
    });

    const conversation = await CommunityConversation.create({
      conversationType: "GROUP",
      groupId: group._id,
      participants: [userId],
      status: "ACTIVE",
      requestedBy: userId,
      lastMessageAt: new Date(),
    });

    return {
      id: String(group._id),
      name: group.name,
      description: group.description || "",
      visibility: group.visibility,
      sport: group.sport || "",
      city: group.city || "",
      memberAddPolicy: group.memberAddPolicy || "ADMIN_ONLY",
      memberCount: group.members.length,
      conversationId: String(conversation._id),
    };
  },

  async updateGroupSettings(
    userId: string,
    groupId: string,
    payload: { memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER" },
  ) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const requesterIsAdmin = group.admins.some(
      (adminId) => String(adminId) === userId,
    );
    if (!requesterIsAdmin) {
      throw new Error("Only group admins can update settings");
    }

    group.memberAddPolicy = payload.memberAddPolicy;
    await group.save();

    return {
      groupId: String(group._id),
      memberAddPolicy: group.memberAddPolicy,
    };
  },

  async joinGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const alreadyMember = group.members.some(
      (memberId) => String(memberId) === userId,
    );
    if (!alreadyMember) {
      group.members.push(new mongoose.Types.ObjectId(userId));
      await group.save();
    }

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
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

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: group.members.length,
    };
  },

  async leaveGroup(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const wasMember = group.members.some(
      (memberId) => String(memberId) === userId,
    );
    if (!wasMember) {
      return { groupId, removed: false };
    }

    group.members = group.members.filter(
      (memberId) => String(memberId) !== userId,
    );
    group.admins = group.admins.filter((adminId) => String(adminId) !== userId);

    if (!group.admins.length && group.members.length) {
      const fallbackAdmin = group.members[0];
      if (fallbackAdmin) {
        group.admins = [fallbackAdmin];
      }
    }

    const groupConversation = await CommunityConversation.findOne({
      conversationType: "GROUP",
      groupId: group._id,
    });

    if (groupConversation) {
      groupConversation.participants = groupConversation.participants.filter(
        (participantId) => String(participantId) !== userId,
      );

      if (!groupConversation.participants.length || !group.members.length) {
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

    if (!group.members.length) {
      await CommunityGroup.deleteOne({ _id: group._id });
      return { groupId: String(group._id), removed: true, deletedGroup: true };
    }

    await group.save();
    return { groupId: String(group._id), removed: true, deletedGroup: false };
  },

  async addGroupMember(userId: string, groupId: string, targetUserId: string) {
    await Promise.all([ensureProfile(userId), ensurePlayerUser(targetUserId)]);

    if (userId === targetUserId) {
      throw new Error("Use join group to add yourself");
    }

    const group = await CommunityGroup.findById(groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const requesterIsAdmin = group.admins.some(
      (adminId) => String(adminId) === userId,
    );
    const requesterIsMember = group.members.some(
      (memberId) => String(memberId) === userId,
    );
    if (!requesterIsMember) {
      throw new Error("Only group members can add members");
    }

    const memberAddPolicy = group.memberAddPolicy || "ADMIN_ONLY";
    if (memberAddPolicy === "ADMIN_ONLY" && !requesterIsAdmin) {
      throw new Error("Only group admins can add members");
    }

    const blocked = await isBlockedBetween(userId, targetUserId);
    if (blocked) {
      throw new Error("Cannot add this player due to privacy settings");
    }

    const alreadyMember = group.members.some(
      (memberId) => String(memberId) === targetUserId,
    );
    if (!alreadyMember) {
      group.members.push(new mongoose.Types.ObjectId(targetUserId));
      await group.save();
    }

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
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

    return {
      groupId: String(group._id),
      conversationId: String(conversation?._id || ""),
      memberCount: group.members.length,
      addedUserId: targetUserId,
      alreadyMember,
    };
  },

  async startConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error("You cannot chat with yourself");
    }

    const [meProfile, targetProfile] = await Promise.all([
      ensureProfile(userId),
      ensureProfile(targetUserId),
    ]);

    const blocked = await isBlockedBetween(userId, targetUserId);
    if (blocked) {
      throw new Error("Conversation unavailable due to privacy settings");
    }

    if (targetProfile.messagePrivacy === "NONE") {
      throw new Error("This player is not accepting new messages");
    }

    const participantKey = buildParticipantKey(userId, targetUserId);
    const initialStatus =
      targetProfile.messagePrivacy === "REQUEST_ONLY" ? "PENDING" : "ACTIVE";

    const conversation = await CommunityConversation.findOneAndUpdate(
      { participantKey },
      {
        $setOnInsert: {
          conversationType: "DM",
          participantKey,
          participants: [userId, targetUserId],
          status: initialStatus,
          requestedBy: userId,
          lastMessageAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    if (!conversation) {
      throw new Error("Failed to start conversation");
    }

    return {
      id: String(conversation._id),
      status: conversation.status,
      requestedBy: String(conversation.requestedBy),
      myAlias: meProfile.anonymousAlias,
    };
  },

  async acceptConversationRequest(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.conversationType === "GROUP") {
      throw new Error("Group conversations do not require acceptance");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    if (conversation.status === "PENDING") {
      const requester = String(conversation.requestedBy);
      if (requester === userId) {
        throw new Error("Requester cannot accept own request");
      }
      conversation.status = "ACTIVE";
      await conversation.save();
    }

    return { id: String(conversation._id), status: conversation.status };
  },

  async rejectConversationRequest(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.conversationType === "GROUP") {
      throw new Error("Group conversations do not support rejection");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const requester = String(conversation.requestedBy);
    if (requester === userId) {
      throw new Error("Requester cannot reject own request");
    }

    await Promise.all([
      CommunityMessage.deleteMany({ conversationId: conversation._id }),
      CommunityConversation.deleteOne({ _id: conversation._id }),
    ]);

    return { rejected: true };
  },

  async listConversations(
    userId: string,
    page = 1,
    limit = 25,
    filters?: {
      mode?: "ALL" | "UNREAD" | "REQUESTS";
      type?: "ALL" | "CONTACTS" | "GROUPS";
      search?: string;
    },
  ) {
    await ensureProfile(userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const mode = filters?.mode || "ALL";
    const type = filters?.type || "ALL";
    const normalizedSearch = (filters?.search || "").trim().toLowerCase();
    const requiresInMemoryFiltering =
      mode !== "ALL" || normalizedSearch.length > 0;

    const conversationQuery: {
      participants: string;
      conversationType?: "GROUP" | { $ne: "GROUP" };
    } = {
      participants: userId,
    };
    if (type === "GROUPS") {
      conversationQuery.conversationType = "GROUP";
    } else if (type === "CONTACTS") {
      conversationQuery.conversationType = { $ne: "GROUP" };
    }

    let total = 0;
    let conversations: any[] = [];

    if (requiresInMemoryFiltering) {
      conversations = await CommunityConversation.find(conversationQuery)
        .sort({ updatedAt: -1 })
        .lean();
      total = conversations.length;
    } else {
      total = await CommunityConversation.countDocuments(conversationQuery);
      conversations = await CommunityConversation.find(conversationQuery)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean();
    }

    if (!conversations.length) {
      return {
        items: [],
        pagination: {
          page: safePage,
          limit: safeLimit,
          total,
          hasMore: skip + conversations.length < total,
        },
      };
    }

    const dmConversations = conversations.filter(
      (conversation) => conversation.conversationType !== "GROUP",
    );

    const otherParticipantIds = dmConversations.map((conversation) => {
      const other = conversation.participants.find(
        (participantId: mongoose.Types.ObjectId) =>
          String(participantId) !== userId,
      );
      return String(other);
    });

    const groupConversationIds = conversations
      .filter((conversation) => conversation.conversationType === "GROUP")
      .map((conversation) => String(conversation.groupId || ""))
      .filter(Boolean);

    const [users, profiles, latestMessages, groups] = await Promise.all([
      User.find({ _id: { $in: otherParticipantIds } })
        .select("_id name photoUrl")
        .lean(),
      CommunityProfile.find({ userId: { $in: otherParticipantIds } })
        .select(
          "userId anonymousAlias isIdentityPublic lastSeenVisible lastSeenAt",
        )
        .lean(),
      CommunityMessage.aggregate([
        {
          $match: { conversationId: { $in: conversations.map((c) => c._id) } },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$conversationId",
            content: { $first: "$content" },
            createdAt: { $first: "$createdAt" },
            senderId: { $first: "$senderId" },
          },
        },
      ]),
      CommunityGroup.find({ _id: { $in: groupConversationIds } })
        .select("_id name description visibility sport city members")
        .lean(),
    ]);

    const unreadStats = await CommunityMessage.aggregate([
      {
        $match: {
          conversationId: {
            $in: conversations.map((conversation) => conversation._id),
          },
          senderId: { $ne: new mongoose.Types.ObjectId(userId) },
          readBy: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $group: {
          _id: "$conversationId",
          unreadCount: { $sum: 1 },
        },
      },
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile]),
    );
    const messageMap = new Map(
      latestMessages.map((message) => [String(message._id), message]),
    );
    const unreadMap = new Map(
      unreadStats.map((item) => [
        String(item._id),
        Number(item.unreadCount) || 0,
      ]),
    );
    const groupMap = new Map(groups.map((group) => [String(group._id), group]));

    const mappedItems = conversations.map((conversation) => {
      const conversationType = conversation.conversationType || "DM";
      const otherId = String(
        conversation.participants.find(
          (participantId: mongoose.Types.ObjectId) =>
            String(participantId) !== userId,
        ),
      );
      const otherUser = userMap.get(otherId);
      const otherProfile = profileMap.get(otherId);
      const latest = messageMap.get(String(conversation._id));
      const group = conversation.groupId
        ? groupMap.get(String(conversation.groupId))
        : null;
      const groupMemberCount = group?.members?.length || 0;

      return {
        id: String(conversation._id),
        conversationType,
        status: conversation.status,
        requestedBy: String(conversation.requestedBy),
        otherParticipant: {
          id: conversationType === "GROUP" ? String(group?._id || "") : otherId,
          displayName:
            conversationType === "GROUP"
              ? group?.name || "Community Group"
              : otherProfile?.isIdentityPublic
                ? otherUser?.name || "Player"
                : otherProfile?.anonymousAlias || "Anonymous Player",
          isIdentityPublic:
            conversationType === "GROUP"
              ? true
              : otherProfile?.isIdentityPublic || false,
          photoUrl:
            conversationType === "GROUP"
              ? null
              : otherProfile?.isIdentityPublic
                ? otherUser?.photoUrl || null
                : null,
          lastSeenAt:
            conversationType === "GROUP"
              ? null
              : otherProfile?.lastSeenVisible
                ? otherProfile?.lastSeenAt || null
                : null,
        },
        group:
          conversationType === "GROUP"
            ? {
                id: String(group?._id || ""),
                name: group?.name || "Community Group",
                description: group?.description || "",
                visibility: group?.visibility || "PUBLIC",
                sport: group?.sport || "",
                city: group?.city || "",
                memberCount: groupMemberCount,
              }
            : null,
        latestMessage: latest
          ? {
              content: latest.content,
              createdAt: latest.createdAt,
              senderId: String(latest.senderId),
            }
          : null,
        unreadCount: unreadMap.get(String(conversation._id)) || 0,
        updatedAt: conversation.updatedAt,
      };
    });

    const filteredItems = mappedItems.filter((conversation) => {
      const modeMatches =
        mode === "UNREAD"
          ? conversation.unreadCount > 0
          : mode === "REQUESTS"
            ? conversation.status === "PENDING" &&
              conversation.conversationType !== "GROUP"
            : true;

      if (!modeMatches) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const displayName = conversation.otherParticipant.displayName
        .toLowerCase()
        .trim();
      const latestMessage = (conversation.latestMessage?.content || "")
        .toLowerCase()
        .trim();
      return (
        displayName.includes(normalizedSearch) ||
        latestMessage.includes(normalizedSearch)
      );
    });

    const pagedItems = requiresInMemoryFiltering
      ? filteredItems.slice(skip, skip + safeLimit)
      : filteredItems;
    const effectiveTotal = requiresInMemoryFiltering
      ? filteredItems.length
      : total;

    return {
      items: pagedItems,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: effectiveTotal,
        hasMore: skip + pagedItems.length < effectiveTotal,
      },
    };
  },

  async listRecentConversationIdsForRealtime(userId: string, limit = 30) {
    await ensureProfile(userId);

    const safeLimit = Math.min(100, Math.max(1, limit));
    const conversations = await CommunityConversation.find(
      {
        participants: userId,
      },
      { _id: 1 },
    )
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    return conversations.map((conversation) => String(conversation._id));
  },

  async markConversationRead(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const unreadMessages = await CommunityMessage.find({
      conversationId,
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      readBy: { $ne: new mongoose.Types.ObjectId(userId) },
    })
      .select("_id")
      .lean();

    if (!unreadMessages.length) {
      return {
        conversationId: String(conversation._id),
        participantIds: conversation.participants.map((participantId) =>
          String(participantId),
        ),
        readerId: userId,
        messageIds: [] as string[],
      };
    }

    await CommunityMessage.updateMany(
      {
        _id: { $in: unreadMessages.map((message) => message._id) },
      },
      {
        $addToSet: { readBy: new mongoose.Types.ObjectId(userId) },
      },
    );

    return {
      conversationId: String(conversation._id),
      participantIds: conversation.participants.map((participantId) =>
        String(participantId),
      ),
      readerId: userId,
      messageIds: unreadMessages.map((message) => String(message._id)),
    };
  },

  async getMessages(
    userId: string,
    conversationId: string,
    page = 1,
    limit = 30,
  ) {
    const conversation =
      await CommunityConversation.findById(conversationId).lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    await this.markConversationRead(userId, conversationId);

    const [messages, total] = await Promise.all([
      CommunityMessage.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommunityMessage.countDocuments({ conversationId }),
    ]);

    const allParticipantIds = conversation.participants.map((id) => String(id));
    const users = await User.find({ _id: { $in: allParticipantIds } })
      .select("_id name photoUrl")
      .lean();
    const profiles = await CommunityProfile.find({
      userId: { $in: allParticipantIds },
    })
      .select("userId anonymousAlias isIdentityPublic readReceiptsEnabled")
      .lean();

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.userId), profile]),
    );

    const messageItems = messages.reverse().map((message) => {
      const senderId = String(message.senderId);
      const sender = userMap.get(senderId);
      const senderProfile = profileMap.get(senderId);
      const isSelf = senderId === userId;
      const readBy = (message.readBy || [])
        .map((readerId) => String(readerId))
        .filter((readerId) => {
          if (readerId === userId) {
            return true;
          }

          const readerProfile = profileMap.get(readerId);
          return readerProfile?.readReceiptsEnabled !== false;
        });

      return {
        id: String(message._id),
        conversationId: String(message.conversationId),
        conversationType: conversation.conversationType || "DM",
        senderId,
        senderDisplayName: isSelf
          ? sender?.name || "Me"
          : senderProfile?.isIdentityPublic
            ? sender?.name || "Player"
            : senderProfile?.anonymousAlias || "Anonymous Player",
        content: message.content,
        createdAt: message.createdAt,
        readBy,
        participantIds: allParticipantIds,
      };
    });

    const conversationType = conversation.conversationType || "DM";
    const group =
      conversationType === "GROUP" && conversation.groupId
        ? await CommunityGroup.findById(conversation.groupId)
            .select("_id name description visibility sport city members")
            .lean()
        : null;

    return {
      conversation: {
        id: String(conversation._id),
        conversationType,
        status: conversation.status,
        requestedBy: String(conversation.requestedBy),
        group:
          conversationType === "GROUP"
            ? {
                id: String(group?._id || ""),
                name: group?.name || "Community Group",
                description: group?.description || "",
                visibility: group?.visibility || "PUBLIC",
                sport: group?.sport || "",
                city: group?.city || "",
                memberCount: group?.members?.length || 0,
              }
            : null,
      },
      messages: messageItems,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async sendMessage(userId: string, conversationId: string, content: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    if (conversation.conversationType !== "GROUP") {
      const otherParticipantId = String(
        conversation.participants.find(
          (participantId) => String(participantId) !== userId,
        ),
      );

      const otherProfile = await ensureProfile(otherParticipantId);
      if (otherProfile.messagePrivacy === "NONE") {
        throw new Error("This player is not accepting new messages");
      }

      const blocked = await isBlockedBetween(userId, otherParticipantId);
      if (blocked) {
        throw new Error("Message blocked due to privacy settings");
      }
    }

    if (
      conversation.status === "PENDING" &&
      conversation.conversationType !== "GROUP"
    ) {
      const requester = String(conversation.requestedBy);
      if (requester !== userId) {
        throw new Error("Please accept this message request first");
      }
    }

    const message = await CommunityMessage.create({
      conversationId,
      senderId: userId,
      content: content.trim(),
      readBy: [new mongoose.Types.ObjectId(userId)],
    });

    conversation.lastMessageAt = new Date();
    await conversation.save();

    const participants = await User.find({
      _id: { $in: conversation.participants },
    })
      .select("_id name photoUrl")
      .lean();
    const profiles = await CommunityProfile.find({
      userId: { $in: conversation.participants },
    })
      .select("userId anonymousAlias isIdentityPublic")
      .lean();

    const sender = participants.find(
      (participant) => String(participant._id) === userId,
    );
    const senderProfile = profiles.find(
      (profile) => String(profile.userId) === userId,
    );

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId: String(message.senderId),
      senderDisplayName: senderProfile?.isIdentityPublic
        ? sender?.name || "Player"
        : senderProfile?.anonymousAlias || "Anonymous Player",
      content: message.content,
      createdAt: message.createdAt,
      readBy: [String(message.senderId)],
      participantIds: conversation.participants.map((participantId) =>
        String(participantId),
      ),
    };
  },

  async createReport(
    userId: string,
    payload: {
      targetType: "MESSAGE" | "GROUP";
      targetId: string;
      reason: string;
      details?: string;
    },
  ) {
    await ensureProfile(userId);

    if (payload.targetType === "MESSAGE") {
      const message = await CommunityMessage.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!message) {
        throw new Error("message not found");
      }
    } else {
      const group = await CommunityGroup.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!group) {
        throw new Error("group not found");
      }
    }

    const report = await CommunityReport.create({
      reporterUserId: userId,
      targetType: payload.targetType,
      targetId: payload.targetId,
      reason: payload.reason.trim(),
      details: payload.details?.trim() || "",
      status: "OPEN",
    });

    return {
      id: String(report._id),
      status: report.status,
      targetType: report.targetType,
      createdAt: report.createdAt,
    };
  },

  async listMyReports(userId: string, page = 1, limit = 20) {
    await ensureProfile(userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      CommunityReport.find({ reporterUserId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      CommunityReport.countDocuments({ reporterUserId: userId }),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        targetType: item.targetType,
        targetId: String(item.targetId),
        reason: item.reason,
        details: item.details || "",
        status: item.status,
        resolutionNote: item.resolutionNote || "",
        createdAt: item.createdAt,
        reviewedAt: item.reviewedAt || null,
      })),
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  async touchLastSeen(userId: string) {
    await CommunityProfile.updateOne(
      { userId },
      { $set: { lastSeenAt: new Date() } },
      { upsert: true },
    );
  },

  async assertConversationAccess(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId,
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    return conversation;
  },

  formatSocketParticipant(
    selfId: string,
    participant: {
      _id: mongoose.Types.ObjectId;
      name: string;
      photoUrl?: string;
      profile?: {
        anonymousAlias: string;
        isIdentityPublic: boolean;
        lastSeenVisible: boolean;
        lastSeenAt?: Date;
      };
    },
  ) {
    return formatParticipant(selfId, participant);
  },

  async getParticipantIds(conversation: CommunityConversationDocument) {
    return conversation.participants.map((participantId) =>
      String(participantId),
    );
  },
};
