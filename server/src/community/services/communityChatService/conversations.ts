import mongoose from "mongoose";
import { User } from "../../../client/models/User";
import { CommunityConversation } from "../../models/CommunityConversation";
import { CommunityGroup } from "../../models/CommunityGroup";
import { CommunityMessage } from "../../models/CommunityMessage";
import { CommunityProfile } from "../../models/CommunityProfile";
import {
  COMMUNITY_INTERACTION_POLICY,
  ROLE_LABEL,
  isCrossRoleInteraction,
} from "../communityPolicy";
import {
  buildParticipantKey,
  describeNonTextMessage,
  ensurePolicyAllowed,
  ensureProfile,
  getCommunityRole,
  isBlockedBetween,
  resolveUserPhotoUrl,
  sendCommunityNotification,
  trackCommunityRoleMixEvent,
} from "../communityShared";

export const conversationsService = {
  async startConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error("You cannot chat with yourself");
    }

    const [meProfile, targetProfile] = await Promise.all([
      ensureProfile(userId),
      ensureProfile(targetUserId),
    ]);

    const [requesterRole, targetRole] = await Promise.all([
      getCommunityRole(userId),
      getCommunityRole(targetUserId),
    ]);

    if (isCrossRoleInteraction(requesterRole, targetRole)) {
      ensurePolicyAllowed(
        COMMUNITY_INTERACTION_POLICY.allowCrossRoleDm,
        `Direct messages between ${ROLE_LABEL[requesterRole]} and ${ROLE_LABEL[targetRole]} accounts are currently disabled`
      );
      trackCommunityRoleMixEvent("dm_cross_role_start", {
        requesterRole,
        targetRole,
      });
    }

    const blocked = await isBlockedBetween(userId, targetUserId);
    if (blocked) {
      throw new Error("Conversation unavailable due to privacy settings");
    }

    if (targetProfile.messagePrivacy === "NONE") {
      throw new Error("This player is not accepting new messages");
    }

    const participantKey = buildParticipantKey(userId, targetUserId);
    const existingConversation = await CommunityConversation.findOne({
      participantKey,
    });
    if (existingConversation) {
      return {
        id: String(existingConversation._id),
        status: existingConversation.status,
        requestedBy: String(existingConversation.requestedBy),
        myAlias: meProfile.anonymousAlias,
      };
    }

    const initialStatus = targetProfile.messagePrivacy === "REQUEST_ONLY" ? "PENDING" : "ACTIVE";

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
      { upsert: true, new: true }
    );

    if (!conversation) {
      throw new Error("Failed to start conversation");
    }

    if (targetUserId !== userId) {
      sendCommunityNotification(
        targetUserId,
        initialStatus === "PENDING" ? "New message request" : "New conversation started",
        initialStatus === "PENDING"
          ? "Someone wants to connect with you in community chat."
          : "Someone started a conversation with you.",
        {
          event:
            initialStatus === "PENDING"
              ? "COMMUNITY_CONVERSATION_REQUESTED"
              : "COMMUNITY_CONVERSATION_STARTED",
          conversationId: String(conversation._id),
          actorUserId: userId,
        }
      );
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
      (participantId) => String(participantId) === userId
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

      sendCommunityNotification(
        requester,
        "Message request accepted",
        "Your community conversation request was accepted.",
        {
          event: "COMMUNITY_CONVERSATION_ACCEPTED",
          conversationId: String(conversation._id),
          actorUserId: userId,
        }
      );
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
      (participantId) => String(participantId) === userId
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const requester = String(conversation.requestedBy);
    if (requester === userId) {
      throw new Error("Requester cannot reject own request");
    }

    sendCommunityNotification(
      requester,
      "Message request declined",
      "Your community conversation request was declined.",
      {
        event: "COMMUNITY_CONVERSATION_REJECTED",
        conversationId: String(conversation._id),
        actorUserId: userId,
      }
    );

    await Promise.all([
      CommunityMessage.deleteMany({ conversationId: conversation._id }),
      CommunityConversation.deleteOne({ _id: conversation._id }),
    ]);

    return { rejected: true };
  },

  async getUnreadConversationCount(userId: string): Promise<number> {
    const conversations = await CommunityConversation.find({
      participants: userId,
    })
      .select("_id")
      .lean();

    if (!conversations.length) {
      return 0;
    }

    const result = await CommunityMessage.aggregate([
      {
        $match: {
          conversationId: { $in: conversations.map((c) => c._id) },
          senderId: { $ne: new mongoose.Types.ObjectId(userId) },
          readBy: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      { $count: "count" },
    ]);

    return result[0]?.count || 0;
  },

  async listConversations(
    userId: string,
    page = 1,
    limit = 25,
    filters?: {
      mode?: "ALL" | "UNREAD" | "REQUESTS";
      type?: "ALL" | "CONTACTS" | "GROUPS";
      search?: string;
    }
  ) {
    await ensureProfile(userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const mode = filters?.mode || "ALL";
    const type = filters?.type || "ALL";
    const normalizedSearch = (filters?.search || "").trim().toLowerCase();
    // A group conversation is never a "request" — this combination can only
    // ever match nothing, so skip the query entirely rather than build a
    // contradictory filter.
    if (mode === "REQUESTS" && type === "GROUPS") {
      return {
        items: [],
        pagination: { page: safePage, limit: safeLimit, total: 0, hasMore: false },
      };
    }

    // Search matches against the OTHER participant's display name and the
    // latest message's content — neither is queryable in Mongo without the
    // same per-conversation joins the response needs anyway, so it still
    // needs every one of the user's conversations fetched before filtering.
    // UNREAD and REQUESTS, unlike search, describe fields Mongo can filter on
    // directly (a message-unread aggregate keyed by conversation id, and the
    // conversation's own `status`), so those two get pushed into the query
    // instead of pulling the user's whole inbox through the join pipeline
    // below just to throw most of it away.
    const needsFullFetch = normalizedSearch.length > 0;

    const conversationQuery: Record<string, unknown> = {
      participants: userId,
    };
    if (type === "GROUPS") {
      conversationQuery.conversationType = "GROUP";
    } else if (type === "CONTACTS" || mode === "REQUESTS") {
      conversationQuery.conversationType = { $ne: "GROUP" };
    }
    if (mode === "REQUESTS") {
      conversationQuery.status = "PENDING";
    }

    let total = 0;
    let conversations: any[] = [];

    if (needsFullFetch) {
      conversations = await CommunityConversation.find(conversationQuery)
        .sort({ updatedAt: -1 })
        .lean();
      total = conversations.length;
    } else if (mode === "UNREAD") {
      const idOnly = await CommunityConversation.find(conversationQuery, { _id: 1 }).lean();
      const unreadAgg = await CommunityMessage.aggregate([
        {
          $match: {
            conversationId: { $in: idOnly.map((c) => c._id) },
            senderId: { $ne: new mongoose.Types.ObjectId(userId) },
            readBy: { $ne: new mongoose.Types.ObjectId(userId) },
          },
        },
        { $group: { _id: "$conversationId" } },
      ]);
      const unreadIds = unreadAgg.map((row) => row._id);

      total = unreadIds.length;
      conversations = await CommunityConversation.find({
        _id: { $in: unreadIds },
      })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean();
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
      (conversation) => conversation.conversationType !== "GROUP"
    );

    const otherParticipantIds = dmConversations.map((conversation) => {
      const other = conversation.participants.find(
        (participantId: mongoose.Types.ObjectId) => String(participantId) !== userId
      );
      return String(other);
    });

    const groupConversationIds = conversations
      .filter((conversation) => conversation.conversationType === "GROUP")
      .map((conversation) => String(conversation.groupId || ""))
      .filter(Boolean);

    const [users, profiles, latestMessages, groups] = await Promise.all([
      User.find({ _id: { $in: otherParticipantIds } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: otherParticipantIds } })
        .select("userId anonymousAlias isIdentityPublic lastSeenVisible lastSeenAt")
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
            type: { $first: "$type" },
            metadata: { $first: "$metadata" },
            isDeleted: { $first: "$isDeleted" },
          },
        },
      ]),
      CommunityGroup.find({ _id: { $in: groupConversationIds } })
        .select("_id name description visibility sport city memberCount postPolicy pinnedMessageId")
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
    const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));
    const messageMap = new Map(latestMessages.map((message) => [String(message._id), message]));
    const unreadMap = new Map(
      unreadStats.map((item) => [String(item._id), Number(item.unreadCount) || 0])
    );
    const groupMap = new Map(groups.map((group) => [String(group._id), group]));

    const mappedItems = await Promise.all(
      conversations.map(async (conversation) => {
        const conversationType = conversation.conversationType || "DM";
        const otherId = String(
          conversation.participants.find(
            (participantId: mongoose.Types.ObjectId) => String(participantId) !== userId
          )
        );
        const otherUser = userMap.get(otherId);
        const otherProfile = profileMap.get(otherId);
        const latest = messageMap.get(String(conversation._id));
        const group = conversation.groupId ? groupMap.get(String(conversation.groupId)) : null;
        const groupMemberCount = group?.memberCount || 0;

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
              conversationType === "GROUP" ? true : (otherProfile?.isIdentityPublic ?? true),
            photoUrl:
              conversationType === "GROUP"
                ? null
                : otherProfile?.isIdentityPublic && otherUser
                  ? await resolveUserPhotoUrl(otherUser)
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
                content: latest.isDeleted
                  ? "Message deleted"
                  : latest.type === "IMAGE"
                    ? "📷 Image"
                    : // Falling through to `content` for FILE/VOICE would put
                      // an S3 object key in the conversation list.
                      describeNonTextMessage(latest.type, latest.metadata) || latest.content,
                createdAt: latest.createdAt,
                senderId: String(latest.senderId),
                type: latest.type || "TEXT",
              }
            : null,
          unreadCount: unreadMap.get(String(conversation._id)) || 0,
          updatedAt: conversation.updatedAt,
        };
      })
    );

    const filteredItems = mappedItems.filter((conversation) => {
      const modeMatches =
        mode === "UNREAD"
          ? conversation.unreadCount > 0
          : mode === "REQUESTS"
            ? conversation.status === "PENDING" && conversation.conversationType !== "GROUP"
            : true;

      if (!modeMatches) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const displayName = conversation.otherParticipant.displayName.toLowerCase().trim();
      const latestMessage = (conversation.latestMessage?.content || "").toLowerCase().trim();
      return displayName.includes(normalizedSearch) || latestMessage.includes(normalizedSearch);
    });

    const pagedItems = needsFullFetch ? filteredItems.slice(skip, skip + safeLimit) : filteredItems;
    const effectiveTotal = needsFullFetch ? filteredItems.length : total;

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
      { _id: 1 }
    )
      .sort({ updatedAt: -1 })
      .limit(safeLimit)
      .lean();

    return conversations.map((conversation) => String(conversation._id));
  },

  async markConversationRead(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId)
      .select("participants")
      .lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId
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
        participantIds: conversation.participants.map((participantId) => String(participantId)),
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
      }
    );

    return {
      conversationId: String(conversation._id),
      participantIds: conversation.participants.map((participantId) => String(participantId)),
      readerId: userId,
      messageIds: unreadMessages.map((message) => String(message._id)),
    };
  },

  async markConversationDelivered(userId: string, conversationId: string) {
    const conversation = await CommunityConversation.findById(conversationId)
      .select("participants")
      .lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const undeliveredMessages = await CommunityMessage.find({
      conversationId,
      senderId: { $ne: new mongoose.Types.ObjectId(userId) },
      deliveredTo: { $ne: new mongoose.Types.ObjectId(userId) },
    })
      .select("_id")
      .lean();

    if (!undeliveredMessages.length) {
      return {
        conversationId: String(conversation._id),
        participantIds: conversation.participants.map((participantId) => String(participantId)),
        readerId: userId,
        messageIds: [] as string[],
      };
    }

    await CommunityMessage.updateMany(
      {
        _id: { $in: undeliveredMessages.map((message) => message._id) },
      },
      {
        $addToSet: { deliveredTo: new mongoose.Types.ObjectId(userId) },
      }
    );

    return {
      conversationId: String(conversation._id),
      participantIds: conversation.participants.map((participantId) => String(participantId)),
      readerId: userId,
      messageIds: undeliveredMessages.map((message) => String(message._id)),
    };
  },
};
