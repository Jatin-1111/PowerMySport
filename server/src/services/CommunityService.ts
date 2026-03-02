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
      memberCount: group.members.length,
      conversationId: String(conversation._id),
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

  async listConversations(userId: string) {
    await ensureProfile(userId);

    const conversations = await CommunityConversation.find({
      participants: userId,
    })
      .sort({ updatedAt: -1 })
      .lean();

    if (!conversations.length) {
      return [];
    }

    const dmConversations = conversations.filter(
      (conversation) => conversation.conversationType !== "GROUP",
    );

    const otherParticipantIds = dmConversations.map((conversation) => {
      const other = conversation.participants.find(
        (participantId) => String(participantId) !== userId,
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

    return conversations.map((conversation) => {
      const conversationType = conversation.conversationType || "DM";
      const otherId = String(
        conversation.participants.find(
          (participantId) => String(participantId) !== userId,
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

    await CommunityMessage.updateMany(
      {
        conversationId,
        senderId: { $ne: new mongoose.Types.ObjectId(userId) },
        readBy: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      {
        $addToSet: { readBy: new mongoose.Types.ObjectId(userId) },
      },
    );

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
      .select("userId anonymousAlias isIdentityPublic")
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

      return {
        id: String(message._id),
        conversationId: String(message.conversationId),
        senderId,
        senderDisplayName: isSelf
          ? sender?.name || "Me"
          : senderProfile?.isIdentityPublic
            ? sender?.name || "Player"
            : senderProfile?.anonymousAlias || "Anonymous Player",
        content: message.content,
        createdAt: message.createdAt,
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
      participantIds: conversation.participants.map((participantId) =>
        String(participantId),
      ),
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
