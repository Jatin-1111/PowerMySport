import { Producer } from "kafkajs";
import { createKafkaClient, COMMUNITY_MESSAGES_TOPIC } from "../../config/kafka";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessageEvent {
  /** Client-generated temp ID so the sender can match the optimistic message */
  tempId: string;
  conversationId: string;
  senderId: string;
  content: string;
  /** ISO timestamp from validation step (used as createdAt in consumer) */
  queuedAt: string;
}

// ── Singleton producer ────────────────────────────────────────────────────────

let producer: Producer | null = null;
let isConnected = false;
let kafkaAvailable = true; // flipped to false on first connection failure

/**
 * Lazily connects the Kafka producer on the first call.
 * Returns false if Kafka is not reachable (caller falls back to direct write).
 */
const getProducer = async (): Promise<Producer | null> => {
  if (!kafkaAvailable) return null;
  if (producer && isConnected) return producer;

  try {
    const kafka = createKafkaClient();
    producer = kafka.producer({
      // Wait for all in-sync replicas to acknowledge (safe for chat)
      allowAutoTopicCreation: true,
    });

    await producer.connect();
    isConnected = true;
    console.log("📨 Kafka producer connected");
    return producer;
  } catch (err) {
    kafkaAvailable = false;
    console.warn(
      "⚠️  Kafka producer unavailable — messages will fall back to direct DB write:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Produce a chat message event to the community.messages Kafka topic.
 *
 * Messages are keyed by conversationId so Kafka preserves ordering within
 * each conversation (same partition = same order guarantee).
 *
 * @returns true if produced successfully, false if Kafka unavailable (caller
 *          should fall back to direct MongoDB write).
 */
export const produceMessage = async (
  payload: ChatMessageEvent,
): Promise<boolean> => {
  const p = await getProducer();
  if (!p) return false;

  try {
    await p.send({
      topic: COMMUNITY_MESSAGES_TOPIC,
      messages: [
        {
          key: payload.conversationId, // partition key — order per conversation
          value: JSON.stringify(payload),
          headers: {
            source: "community-socket",
            version: "1",
          },
        },
      ],
    });
    return true;
  } catch (err) {
    console.error("[kafka:producer] Failed to produce message:", err);
    isConnected = false; // will reconnect on next attempt
    return false;
  }
};

/**
 * Graceful shutdown — call on SIGTERM to flush in-flight messages.
 */
export const disconnectProducer = async (): Promise<void> => {
  if (producer && isConnected) {
    try {
      await producer.disconnect();
      console.log("📨 Kafka producer disconnected");
    } catch {
      // ignore shutdown errors
    }
  }
};
