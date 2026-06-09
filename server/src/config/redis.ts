import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(REDIS_URL, {
  lazyConnect: true, // Only connect when a query is made
  maxRetriesPerRequest: 3,
});

redis.on("error", (err) => {
  console.warn("Redis connection error:", err.message);
});

export default redis;
