import { Server } from "socket.io";
import mongoose from "mongoose";
import { createKafkaClient, COMMUNITY_MESSAGES_TOPIC } from "../../config/kafka";
import { ChatMessageEvent } from "./MessageProducerService";
import { CommunityMessage } from "../models/CommunityMessage";
import { CommunityConversation } from "../models/CommunityConversation";
import { CommunityProfile } from "../models/CommunityProfile";
import { User } from "../../client/models/User";
import OutboxMessage from "../../shared/models/OutboxMessage";
import { S3Service } from "../../shared/services/S3Service";

// ── Helpers ───────────────────────────────────────────────────────────────────

const resolvePhotoUrl = async (user: {
  photoUrl?: string;
  photoS3Key?: string;
}) => {
  if (user.photoS3Key) {
    return S3Service.getInstance().getSignedUrl(user.photoS3Key);
  }
  return user.photoUrl || null;
};

// ── Consumer ──────────────────────────────────────────────────────────────────

/**
 * Starts the Kafka consumer that reads community chat messages and persists
 * them to MongoDB, then broadcasts the confirmed message via Socket.IO.
 *
 * Returns a shutdown function to call on SIGTERM.
 *
 * Pattern:
 *   Socket → Kafka (fast, non-blocking)
 *   Consumer → MongoDB write (controlled rate) → Socket.IO broadcast
 */
export const startMessageConsumer = async (
  io: Server,
): Promise<(() => Promise<void>) | null> => {
  try {
    const kafka = createKafkaClient();
    const consumer = kafka.consumer({
      groupId: "community-message-writers",
      // If the offset is not found (new consumer group), start from the latest
      // message — we don't want to reprocess old messages on first boot.
    });

    await consumer.connect();
    await consumer.subscribe({
      topic: COMMUNITY_MESSAGES_TOPIC,
      fromBeginning: false,
    });

    await consumer.run({
      // Process one message at a time per partition to keep DB write order safe.
      eachMessage: async ({ message }) => {
        if (!message.value) return;

        let event: ChatMessageEvent;
        try {
          event = JSON.parse(message.value.toString()) as ChatMessageEvent;
        } catch {
          console.error("[kafka:consumer] Failed to parse message:", message.value.toString());
          return;
        }

        try {
          await persistAndBroadcast(io, event);
        } catch (err) {
          // Log and continue — don't crash the consumer on a bad message.
          console.error("[kafka:consumer] Failed to persist message:", err);
        }
      },
    });

    console.log("✅ Kafka message consumer started (community.messages)");

    return async () => {
      await consumer.disconnect();
      console.log("📨 Kafka message consumer stopped");
    };
  } catch (err) {
    console.warn(
      "⚠️  Kafka consumer unavailable — messages will be written directly to DB:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
};

// ── Core DB write + broadcast ─────────────────────────────────────────────────

async function persistAndBroadcast(io: Server, event: ChatMessageEvent) {
  const { conversationId, senderId, content, tempId } = event;

  // 1. Load conversation (needed for participants + lastMessageAt update)
  const conversation = await CommunityConversation.findById(conversationId);
  if (!conversation) {
    console.warn(`[kafka:consumer] Conversation ${conversationId} not found — dropping message`);
    return;
  }

  // 2. Write message to MongoDB
  const message = await CommunityMessage.create({
    conversationId,
    senderId,
    content: content.trim(),
    readBy: [new mongoose.Types.ObjectId(senderId)],
  });

  // 3. Update conversation's lastMessageAt
  conversation.lastMessageAt = new Date();
  await conversation.save();

  // 4. Load sender display info
  const allParticipantIds = conversation.participants.map((id) => String(id));

  const [participants, profiles] = await Promise.all([
    User.find({ _id: { $in: allParticipantIds } })
      .select("_id name photoUrl photoS3Key")
      .lean(),
    CommunityProfile.find({ userId: { $in: allParticipantIds } })
      .select("userId anonymousAlias isIdentityPublic")
      .lean(),
  ]);

  const sender = participants.find((p) => String(p._id) === senderId);
  const senderProfile = profiles.find((p) => String(p.userId) === senderId);
  const senderDisplayName = senderProfile?.isIdentityPublic
    ? sender?.name || "Player"
    : senderProfile?.anonymousAlias || "Anonymous Player";

  const otherParticipantIds = allParticipantIds.filter((id) => id !== senderId);

  // 5. Enqueue outbox notification
  try {
    await OutboxMessage.create({
      type: "deliver_message",
      payload: {
        conversationId: String(conversation._id),
        messageId: String(message._id),
        actorUserId: senderId,
        conversationType: conversation.conversationType || "DM",
        participantIds: otherParticipantIds,
        summary: `${senderDisplayName} sent you a message in community chat.`,
      },
      status: "PENDING",
      attempts: 0,
    });
  } catch (err) {
    console.error("[kafka:consumer] Failed to enqueue outbox notification:", err);
  }

  // 6. Build confirmed message payload (includes real MongoDB _id)
  const confirmedMessage = {
    id: String(message._id),
    tempId, // lets the sender's UI swap the optimistic message for the confirmed one
    conversationId: String(message.conversationId),
    conversationType: conversation.conversationType || "DM",
    senderId: String(message.senderId),
    senderDisplayName,
    content: message.content,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    editedAt: null,
    isEdited: false,
    isDeleted: false,
    readBy: [String(message.senderId)],
    participantIds: allParticipantIds,
  };

  // 7. Broadcast to all participants in the conversation room
  io.to(`conversation:${conversationId}`).emit(
    "community:newMessage",
    confirmedMessage,
  );

  // 8. Ping each participant's personal room so their conversation list updates
  for (const participantId of allParticipantIds) {
    io.to(`user:${participantId}`).emit("community:conversationUpdated", {
      conversationId,
      conversationType: conversation.conversationType || "DM",
    });
  }
}
