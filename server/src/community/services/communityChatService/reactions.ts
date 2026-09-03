import mongoose from "mongoose";
import { CommunityConversation } from "../../models/CommunityConversation";
import { CommunityGroup } from "../../models/CommunityGroup";
import { CommunityMessage } from "../../models/CommunityMessage";
import { CommunityMessageReaction } from "../../models/CommunityMessageReaction";
import { isGroupAdmin } from "../communityGroupMembership";
import { assertConversationAccess } from "../communityShared";

export const reactionsService = {
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
};
