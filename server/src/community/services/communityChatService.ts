import { User } from "../../client/models/User";
import OutboxMessage from "../../shared/models/OutboxMessage";
import { CommunityConversation } from "../models/CommunityConversation";
import { CommunityGroup } from "../models/CommunityGroup";
import { CommunityMessage, type CommunityMessageType } from "../models/CommunityMessage";
import { CommunityMessageReaction } from "../models/CommunityMessageReaction";
import { CommunityProfile } from "../models/CommunityProfile";
import { getMemberRole, isGroupAdmin } from "./communityGroupMembership";
import {
  COMMUNITY_INTERACTION_POLICY,
  ROLE_LABEL,
  isCrossRoleInteraction,
} from "./communityPolicy";
import {
  MESSAGE_EDIT_DELETE_WINDOW_MS,
  assertConversationAccess,
  buildParticipantKey,
  describeNonTextMessage,
  ensurePolicyAllowed,
  ensureProfile,
  getCommunityRole,
  isBlockedBetween,
  normalizeMessageMetadata,
  resolveUserPhotoUrl,
  sendCommunityNotification,
  trackCommunityRoleMixEvent,
} from "./communityShared";
import mongoose from "mongoose";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("communityChat");

/**
 * Conversations and messages: sending, editing, reactions, receipts.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityChatService = {
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

  async getMessages(userId: string, conversationId: string, page = 1, limit = 30) {
    const conversation = await CommunityConversation.findById(conversationId).lean();
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    const [messages, total] = await Promise.all([
      CommunityMessage.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CommunityMessage.countDocuments({ conversationId }),
    ]);

    const allParticipantIds = conversation.participants.map((id) => String(id));
    const conversationType = conversation.conversationType || "DM";
    const replyTargetIds = messages.flatMap((message) =>
      message.replyToId ? [message.replyToId] : []
    );

    // None of these five depend on each other — only on `messages`/
    // `conversation`, both already resolved above — so they run concurrently
    // instead of as five sequential round trips.
    const [users, profiles, reactionRows, replyTargets, group] = await Promise.all([
      User.find({ _id: { $in: allParticipantIds } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: allParticipantIds } })
        .select("userId anonymousAlias isIdentityPublic readReceiptsEnabled")
        .lean(),
      // One query for the whole page's reactions, grouped client-side below.
      CommunityMessageReaction.find({
        messageId: { $in: messages.map((message) => message._id) },
      })
        .select("messageId userId emoji")
        .lean(),
      // One query for every quoted message on the page, rather than a
      // lookup per message. Quotes are resolved live rather than
      // snapshotted at send time, so an edit to the original shows through
      // and a deletion is visible.
      replyTargetIds.length
        ? CommunityMessage.find({ _id: { $in: replyTargetIds } })
            .select("_id senderId type content isDeleted metadata")
            .lean()
        : Promise.resolve([]),
      conversationType === "GROUP" && conversation.groupId
        ? CommunityGroup.findById(conversation.groupId)
            .select(
              "_id name description visibility sport city memberCount postPolicy pinnedMessageId"
            )
            .lean()
        : Promise.resolve(null),
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));

    const reactionsByMessage = new Map<
      string,
      { emoji: string; count: number; reactedByMe: boolean }[]
    >();
    for (const reaction of reactionRows) {
      const key = String(reaction.messageId);
      const bucket = reactionsByMessage.get(key) || [];
      const existing = bucket.find((item) => item.emoji === reaction.emoji);
      if (existing) {
        existing.count += 1;
        existing.reactedByMe = existing.reactedByMe || String(reaction.userId) === userId;
      } else {
        bucket.push({
          emoji: reaction.emoji,
          count: 1,
          reactedByMe: String(reaction.userId) === userId,
        });
      }
      reactionsByMessage.set(key, bucket);
    }

    const replyTargetMap = new Map(replyTargets.map((target) => [String(target._id), target]));

    const shapeReplyPreview = (replyToId?: mongoose.Types.ObjectId | null) => {
      if (!replyToId) {
        return null;
      }

      const target = replyTargetMap.get(String(replyToId));
      if (!target) {
        return null;
      }

      const targetSenderId = String(target.senderId);
      const targetProfile = profileMap.get(targetSenderId);
      const targetUser = userMap.get(targetSenderId);

      return {
        id: String(target._id),
        senderId: targetSenderId,
        senderDisplayName:
          targetSenderId === userId
            ? targetUser?.name || "Me"
            : targetProfile?.isIdentityPublic
              ? targetUser?.name || "Player"
              : targetProfile?.anonymousAlias || "Anonymous Player",
        type: target.type || "TEXT",
        // An image quote shows a label, never the S3 key that `content` holds.
        content: target.isDeleted
          ? "Message deleted"
          : describeNonTextMessage(target.type, target.metadata) ||
            (target.content || "").slice(0, 140),
        isDeleted: Boolean(target.isDeleted),
      };
    };

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
        type: message.type || "TEXT",
        senderDisplayName: isSelf
          ? sender?.name || "Me"
          : senderProfile?.isIdentityPublic
            ? sender?.name || "Player"
            : senderProfile?.anonymousAlias || "Anonymous Player",
        content: message.isDeleted ? "Message deleted" : message.content,
        metadata: normalizeMessageMetadata(message.metadata),
        replyTo: shapeReplyPreview(message.replyToId),
        reactions: (reactionsByMessage.get(String(message._id)) || []).sort(
          (a, b) => b.count - a.count
        ),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        editedAt: message.editedAt || null,
        isEdited: Boolean(message.editedAt),
        isDeleted: Boolean(message.isDeleted),
        readBy,
        participantIds: allParticipantIds,
      };
    });

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
                memberCount: group?.memberCount || 0,
                postPolicy: group?.postPolicy || "ANY_MEMBER",
                pinnedMessageId: group?.pinnedMessageId ? String(group.pinnedMessageId) : null,
                // Whether *this* viewer may post, so the composer can be
                // disabled without the client re-deriving the rule.
                canPost:
                  group?.postPolicy === "ADMIN_ONLY"
                    ? (await getMemberRole(String(group._id), userId)) === "ADMIN"
                    : true,
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

  async sendMessage(
    userId: string,
    conversationId: string,
    content: string,
    options?: {
      type?: CommunityMessageType;
      metadata?: {
        width?: number;
        height?: number;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        durationMs?: number;
        waveform?: number[];
      };
      replyToId?: string;
    }
  ) {
    const conversation = await CommunityConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (participantId) => String(participantId) === userId
    );
    if (!isParticipant) {
      throw new Error("Access denied");
    }

    if (conversation.conversationType === "GROUP" && conversation.groupId) {
      // Announcement groups: everyone reads, only admins post. Checked here
      // rather than in the UI because the socket send path bypasses any
      // client-side gate.
      const group = await CommunityGroup.findById(conversation.groupId).select("postPolicy").lean();
      if (group?.postPolicy === "ADMIN_ONLY") {
        const role = await getMemberRole(String(conversation.groupId), userId);
        if (role !== "ADMIN") {
          throw new Error("Only admins can post in this group");
        }
      }
    }

    if (conversation.conversationType !== "GROUP") {
      const otherParticipantId = String(
        conversation.participants.find((participantId) => String(participantId) !== userId)
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

    if (conversation.status === "PENDING" && conversation.conversationType !== "GROUP") {
      const requester = String(conversation.requestedBy);
      if (requester !== userId) {
        throw new Error("Please accept this message request first");
      }
    }

    const messageType = options?.type || "TEXT";
    const messageDoc: Record<string, unknown> = {
      conversationId,
      senderId: userId,
      type: messageType,
      content: messageType === "TEXT" ? content.trim() : content,
      readBy: [new mongoose.Types.ObjectId(userId)],
    };
    if (messageType !== "TEXT" && options?.metadata) {
      messageDoc.metadata = options.metadata;
    }

    // The quoted message has to live in this conversation. Without the check a
    // client could quote a message out of a chat it cannot read, and the quote
    // preview would leak its text to everyone here.
    if (options?.replyToId) {
      const replyTarget = await CommunityMessage.findOne({
        _id: options.replyToId,
        conversationId: conversation._id,
        isDeleted: false,
      })
        .select("_id")
        .lean();
      if (!replyTarget) {
        throw new Error("The message you replied to is no longer available");
      }
      messageDoc.replyToId = replyTarget._id;
    }

    const message = await CommunityMessage.create(messageDoc);

    conversation.lastMessageAt = new Date();
    await conversation.save();

    const [participants, profiles] = await Promise.all([
      User.find({ _id: { $in: conversation.participants } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: conversation.participants } })
        .select("userId anonymousAlias isIdentityPublic")
        .lean(),
    ]);

    const sender = participants.find((participant) => String(participant._id) === userId);
    const senderProfile = profiles.find((profile) => String(profile.userId) === userId);

    const senderDisplayName = senderProfile?.isIdentityPublic
      ? sender?.name || "Player"
      : senderProfile?.anonymousAlias || "Anonymous Player";

    const otherParticipantIds = conversation.participants
      .map((participantId) => String(participantId))
      .filter((participantId) => participantId !== userId);

    // Enqueue a single outbox delivery job to handle multi-channel fanout
    try {
      await OutboxMessage.create({
        type: "deliver_message",
        payload: {
          conversationId: String(conversation._id),
          messageId: String(message._id),
          actorUserId: userId,
          conversationType: conversation.conversationType || "DM",
          participantIds: otherParticipantIds,
          summary:
            messageType === "IMAGE"
              ? `${senderDisplayName} shared an image in community chat.`
              : `${senderDisplayName} sent you a message in community chat.`,
        },
        status: "PENDING",
        attempts: 0,
      });
    } catch (err) {
      log.error("Failed to enqueue outbox delivery:", err);
      // Fallback to best-effort direct notifications if enqueue fails
      for (const participantId of otherParticipantIds) {
        sendCommunityNotification(
          participantId,
          conversation.conversationType === "GROUP" ? "New group message" : "New message",
          messageType === "IMAGE"
            ? `${senderDisplayName} shared an image in community chat.`
            : `${senderDisplayName} sent you a message in community chat.`,
          {
            event: "COMMUNITY_MESSAGE_RECEIVED",
            conversationId: String(conversation._id),
            messageId: String(message._id),
            actorUserId: userId,
            conversationType: conversation.conversationType || "DM",
          }
        );
      }
    }

    // The sender already has the quoted message on screen, but the payload is
    // broadcast to everyone in the conversation, so the preview has to travel
    // with it or their bubble renders a reply to nothing.
    const replyPreview = message.replyToId
      ? await (async () => {
          const target = await CommunityMessage.findById(message.replyToId)
            .select("_id senderId type content isDeleted metadata")
            .lean();
          if (!target) {
            return null;
          }
          const targetSenderId = String(target.senderId);
          const targetProfile = profiles.find(
            (profile) => String(profile.userId) === targetSenderId
          );
          const targetUser = participants.find(
            (participant) => String(participant._id) === targetSenderId
          );
          return {
            id: String(target._id),
            senderId: targetSenderId,
            senderDisplayName: targetProfile?.isIdentityPublic
              ? targetUser?.name || "Player"
              : targetProfile?.anonymousAlias || "Anonymous Player",
            type: target.type || "TEXT",
            content: target.isDeleted
              ? "Message deleted"
              : describeNonTextMessage(target.type, target.metadata) ||
                (target.content || "").slice(0, 140),
            isDeleted: Boolean(target.isDeleted),
          };
        })()
      : null;

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId: String(message.senderId),
      type: message.type || "TEXT",
      senderDisplayName,
      content: message.content,
      metadata: normalizeMessageMetadata(message.metadata),
      replyTo: replyPreview,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      editedAt: null,
      isEdited: false,
      isDeleted: false,
      readBy: [String(message.senderId)],
      participantIds: conversation.participants.map((participantId) => String(participantId)),
    };
  },

  /**
   * Sets, replaces or clears this user's reaction to a message. One reaction
   * per person: reacting with a different emoji replaces the previous one
   * rather than stacking, and reacting with the same one clears it.
   */
  async reactToMessage(userId: string, messageId: string, emoji: string) {
    const trimmed = (emoji || "").trim();
    if (!trimmed) {
      throw new Error("An emoji is required");
    }

    const message = await CommunityMessage.findById(messageId)
      .select("_id conversationId isDeleted")
      .lean();
    if (!message || message.isDeleted) {
      throw new Error("Message not found");
    }

    // Reacting is participation, so it needs the same access check as reading.
    await assertConversationAccess(userId, String(message.conversationId));

    const existing = await CommunityMessageReaction.findOne({
      messageId: message._id,
      userId,
    })
      .select("_id emoji")
      .lean();

    if (existing && existing.emoji === trimmed) {
      await CommunityMessageReaction.deleteOne({ _id: existing._id });
    } else if (existing) {
      await CommunityMessageReaction.updateOne({ _id: existing._id }, { $set: { emoji: trimmed } });
    } else {
      await CommunityMessageReaction.updateOne(
        { messageId: message._id, userId },
        {
          $setOnInsert: {
            messageId: message._id,
            conversationId: message.conversationId,
            userId: new mongoose.Types.ObjectId(userId),
          },
          $set: { emoji: trimmed },
        },
        { upsert: true }
      );
    }

    const rows = await CommunityMessageReaction.find({
      messageId: message._id,
    })
      .select("userId emoji")
      .lean();

    const grouped: { emoji: string; count: number; reactedByMe: boolean }[] = [];
    for (const row of rows) {
      const bucket = grouped.find((item) => item.emoji === row.emoji);
      if (bucket) {
        bucket.count += 1;
        bucket.reactedByMe = bucket.reactedByMe || String(row.userId) === userId;
      } else {
        grouped.push({
          emoji: row.emoji,
          count: 1,
          reactedByMe: String(row.userId) === userId,
        });
      }
    }

    return {
      messageId: String(message._id),
      conversationId: String(message.conversationId),
      reactions: grouped.sort((a, b) => b.count - a.count),
    };
  },

  /**
   * Pin a message to the top of a group, or clear the pin by passing the one
   * already pinned. Admin-only and one at a time: a pin is a group-wide
   * announcement, not a personal bookmark.
   */
  async pinGroupMessage(userId: string, messageId: string) {
    const message = await CommunityMessage.findById(messageId)
      .select("_id conversationId isDeleted")
      .lean();
    if (!message || message.isDeleted) {
      throw new Error("Message not found");
    }

    const conversation = await CommunityConversation.findById(message.conversationId)
      .select("groupId conversationType")
      .lean();
    if (!conversation?.groupId) {
      throw new Error("Only group messages can be pinned");
    }

    const groupId = String(conversation.groupId);
    if (!(await isGroupAdmin(groupId, userId))) {
      throw new Error("Only group admins can pin a message");
    }

    const group = await CommunityGroup.findById(groupId).select("pinnedMessageId");
    if (!group) {
      throw new Error("Group not found");
    }

    const alreadyPinned = String(group.pinnedMessageId || "") === String(message._id);
    group.pinnedMessageId = alreadyPinned ? null : message._id;
    await group.save();

    return {
      groupId,
      conversationId: String(message.conversationId),
      messageId: String(message._id),
      pinned: !alreadyPinned,
      pinnedMessageId: group.pinnedMessageId ? String(group.pinnedMessageId) : null,
    };
  },

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await CommunityMessage.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const senderId = String(message.senderId);
    if (senderId !== userId) {
      throw new Error("Only the sender can edit this message");
    }

    if (message.isDeleted) {
      throw new Error("Deleted messages cannot be edited");
    }

    if (Date.now() - message.createdAt.getTime() > MESSAGE_EDIT_DELETE_WINDOW_MS) {
      throw new Error("Message edit window has expired");
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error("Message content is required");
    }

    message.content = trimmedContent;
    message.editedAt = new Date();
    await message.save();

    const conversation = await CommunityConversation.findById(message.conversationId)
      .select("participants conversationType")
      .lean();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = conversation.participants.map((participantId) => String(participantId));

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId,
      type: message.type || "TEXT",
      content: message.content,
      metadata: normalizeMessageMetadata(message.metadata),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      editedAt: message.editedAt,
      isEdited: true,
      isDeleted: false,
      readBy: (message.readBy || []).map((readerId) => String(readerId)),
      participantIds: participants,
    };
  },

  async deleteMessage(userId: string, messageId: string) {
    const message = await CommunityMessage.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const senderId = String(message.senderId);
    if (senderId !== userId) {
      throw new Error("Only the sender can delete this message");
    }

    if (message.isDeleted) {
      throw new Error("Message already deleted");
    }

    if (Date.now() - message.createdAt.getTime() > MESSAGE_EDIT_DELETE_WINDOW_MS) {
      throw new Error("Message delete window has expired");
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = new mongoose.Types.ObjectId(userId);
    message.content = "Message deleted";
    await message.save();

    // A deleted message shows as "This message was deleted"; leaving reactions
    // attached would keep a row of emoji under text nobody can read.
    await CommunityMessageReaction.deleteMany({ messageId: message._id });

    // Same for a pin — a group banner pointing at deleted text is worse than
    // no banner.
    await CommunityGroup.updateOne(
      { pinnedMessageId: message._id },
      { $set: { pinnedMessageId: null } }
    );

    const conversation = await CommunityConversation.findById(message.conversationId)
      .select("participants conversationType")
      .lean();

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = conversation.participants.map((participantId) => String(participantId));

    return {
      id: String(message._id),
      conversationId: String(message.conversationId),
      conversationType: conversation.conversationType || "DM",
      senderId,
      type: message.type || "TEXT",
      content: "Message deleted",
      metadata: null,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      editedAt: message.editedAt || null,
      isEdited: Boolean(message.editedAt),
      isDeleted: true,
      readBy: (message.readBy || []).map((readerId) => String(readerId)),
      participantIds: participants,
    };
  },
};
