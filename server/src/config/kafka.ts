import { Kafka, logLevel } from "kafkajs";

// ── Topic names ───────────────────────────────────────────────────────────────
export const COMMUNITY_MESSAGES_TOPIC = "community.messages";

// ── KafkaJS client factory ────────────────────────────────────────────────────
// Called inside startServer() (not at module level) so connection errors are
// contained and never crash the process. Same pattern as createRedisPubSub().
export const createKafkaClient = () => {
  const brokers = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
  const clientId = process.env.KAFKA_CLIENT_ID || "powermysport-server";

  return new Kafka({
    clientId,
    brokers,
    // Suppress verbose kafkajs logs in production; INFO in dev is sufficient.
    logLevel:
      process.env.NODE_ENV === "production" ? logLevel.WARN : logLevel.ERROR,
    // Retry with backoff so a temporary broker blip doesn't spam logs.
    retry: {
      initialRetryTime: 300,
      retries: 5,
    },
  });
};
