import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ── General-purpose client (caching, presence, etc.) ─────────────────────────
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redis.on("error", (err) => {
  console.warn("[redis] connection error:", err.message);
});

/**
 * Creates a dedicated pub/sub client pair for @socket.io/redis-adapter.
 * Called inside startServer() so errors are handled in the startup try/catch.
 * Two separate clients are required because a subscribed Redis client
 * cannot issue regular commands.
 *
 * retryStrategy: () => null — disables automatic reconnection so that if
 * Redis is not available, ioredis gives up immediately instead of flooding
 * the logs. The server falls back to single-instance mode in this case.
 */
export const createRedisPubSub = () => {
  const noRetry = () => null; // tell ioredis: don't retry on disconnect

  const pub = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    retryStrategy: noRetry,
  });
  const sub = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
    retryStrategy: noRetry,
  });

  pub.on("error", (err) => console.warn("[redis:pub] connection error:", err.message));
  sub.on("error", (err) => console.warn("[redis:sub] connection error:", err.message));

  return { pub, sub };
};


export default redis;

