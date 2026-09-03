import mongoose from "mongoose";
import { User } from "../../../client/models/User";
import OutboxMessage from "../../../shared/models/OutboxMessage";
import { CommunityConversation } from "../../models/CommunityConversation";
import { CommunityGroup } from "../../models/CommunityGroup";
import { CommunityMessage, type CommunityMessageType } from "../../models/CommunityMessage";
import { CommunityMessageReaction } from "../../models/CommunityMessageReaction";
import { CommunityProfile } from "../../models/CommunityProfile";
import { getMemberRole } from "../communityGroupMembership";
import {
  MESSAGE_EDIT_DELETE_WINDOW_MS,
  describeNonTextMessage,
  ensureProfile,
  isBlockedBetween,
  normalizeMessageMetadata,
  sendCommunityNotification,
} from "../communityShared";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("communityChat");

export const messagesService = {
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
