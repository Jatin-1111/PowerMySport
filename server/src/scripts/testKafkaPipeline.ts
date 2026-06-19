/**
 * testKafkaPipeline.ts
 *
 * Standalone integration test for the community Kafka message pipeline.
 *
 * What it does:
 *  1. Starts a temporary consumer on the community.messages topic.
 *  2. Waits 2 s for the consumer to join its group.
 *  3. Produces a synthetic ChatMessageEvent to the topic.
 *  4. Waits up to 15 s for the consumer to read it back.
 *  5. Asserts the payload matches, then exits 0 (pass) or 1 (fail).
 *
 * This test does NOT touch MongoDB — it only validates the
 * produce → consume round-trip at the broker level.
 *
 * Usage (Kafka broker must be running):
 *   ts-node src/scripts/testKafkaPipeline.ts
 *
 * Start the local Kafka broker if it's not already up:
 *   docker compose -f docker-compose.kafka.yml up -d
 */

import "dotenv/config";
import { createKafkaClient, COMMUNITY_MESSAGES_TOPIC } from "../config/kafka";
import { ChatMessageEvent } from "../community/kafka/MessageProducerService";

const TIMEOUT_MS = 15_000;
// Use a unique group each run so we always start from the latest offset
const GROUP_ID = `kafka-pipeline-test-${Date.now()}`;

(async () => {
  console.log("\n🧪  Kafka Pipeline Integration Test");
  console.log(`   Broker(s) : ${process.env.KAFKA_BROKERS || "localhost:9092"}`);
  console.log(`   Topic     : ${COMMUNITY_MESSAGES_TOPIC}`);
  console.log(`   Group     : ${GROUP_ID}\n`);

  const kafka = createKafkaClient();
  const producer = kafka.producer({ allowAutoTopicCreation: true });
  const consumer = kafka.consumer({ groupId: GROUP_ID });

  const testEvent: ChatMessageEvent = {
    tempId: `test:${Date.now()}`,
    conversationId: "000000000000000000000001", // fake ObjectId — no DB needed
    senderId: "000000000000000000000002",
    content: "🚀 Hello from Kafka pipeline test!",
    queuedAt: new Date().toISOString(),
  };

  let passed = false;

  try {
    // ── 1. Connect consumer and subscribe ─────────────────────────────────────
    await consumer.connect();
    await consumer.subscribe({
      topic: COMMUNITY_MESSAGES_TOPIC,
      fromBeginning: true, // true = catch message even if consumer joined slightly late; we filter by tempId
    });
    console.log("📥 Consumer subscribed — waiting for group assignment...");

    // ── 2. Start consuming in the background ──────────────────────────────────
    const receivePromise = new Promise<ChatMessageEvent>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(
          new Error(
            `Timeout after ${TIMEOUT_MS} ms — did the broker receive the message?`,
          ),
        );
      }, TIMEOUT_MS);

      consumer.run({
        eachMessage: async ({ message }: any) => {
          if (!message.value) return;
          try {
            const event = JSON.parse(
              message.value.toString(),
            ) as ChatMessageEvent;
            if (event.tempId === testEvent.tempId) {
              clearTimeout(timeoutHandle);
              resolve(event);
            }
          } catch {
            // ignore non-JSON messages
          }
        },
      });
    });

    // ── 3. Give the consumer 6 s to join its group before producing ───────────
    // Increased from 2s → 6s: on a fresh Kafka boot, __consumer_offsets group-
    // coordinator election can take a few seconds before consumers can join.
    await new Promise((r) => setTimeout(r, 6_000));

    // ── 4. Produce the test event ──────────────────────────────────────────────
    await producer.connect();
    await producer.send({
      topic: COMMUNITY_MESSAGES_TOPIC,
      messages: [
        {
          key: testEvent.conversationId,
          value: JSON.stringify(testEvent),
          headers: { source: "test-script", version: "1" },
        },
      ],
    });
    console.log(`📨 Produced — tempId: ${testEvent.tempId}`);

    // ── 5. Wait for the consumer to read it back ───────────────────────────────
    const got = await receivePromise;

    // ── 6. Assert payload integrity ────────────────────────────────────────────
    const ok =
      got.tempId === testEvent.tempId &&
      got.conversationId === testEvent.conversationId &&
      got.senderId === testEvent.senderId &&
      got.content === testEvent.content;

    if (ok) {
      console.log("\n✅  Produce → Consume round-trip: PASSED");
      console.log("    Received payload:", JSON.stringify(got, null, 2));
      passed = true;
    } else {
      console.error("\n❌  Payload mismatch:");
      console.error("    Expected:", testEvent);
      console.error("    Got     :", got);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("\n❌  Test FAILED:", msg);

    if (msg.includes("Timeout") || msg.includes("ECONNREFUSED")) {
      console.error(
        "\n   ⚠️  Make sure the Kafka broker is running:\n" +
          "   docker compose -f docker-compose.kafka.yml up -d\n",
      );
    }
  } finally {
    await Promise.allSettled([producer.disconnect(), consumer.disconnect()]);
    console.log("\n🔌  Producer + consumer disconnected.\n");
    process.exit(passed ? 0 : 1);
  }
})();
