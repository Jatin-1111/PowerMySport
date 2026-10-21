import type { ClientRateLimitInfo, Store } from "express-rate-limit";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import redis from "../config/redis";

/**
 * Redis-backed rate-limit store shared across auto-scaled instances.
 *
 * NOTE: authRoutes.ts has its own inline copy of this for the player-facing
 * auth limiters; this shared module is used by other routes (e.g. admin login)
 * so they get the same distributed, fail-open behaviour.
 */
export const createRedisRateLimitStore = (prefix: string): Store => {
  let windowMs = 60 * 1000;

  return {
    prefix,
    localKeys: false,
    init(options) {
      windowMs = options.windowMs;
    },
    async increment(key: string): Promise<ClientRateLimitInfo> {
      try {
        const redisKey = `${prefix}${key}`;
        const totalHits = await redis.incr(redisKey);
        if (totalHits === 1) {
          await redis.pexpire(redisKey, windowMs);
        }

        const ttl = await redis.pttl(redisKey);
        return {
          totalHits,
          resetTime: ttl > 0 ? new Date(Date.now() + ttl) : new Date(Date.now() + windowMs),
        };
      } catch {
        return {
          totalHits: 1,
          resetTime: new Date(Date.now() + windowMs),
        };
      }
    },
    async decrement(key: string): Promise<void> {
      try {
        await redis.decr(`${prefix}${key}`);
      } catch {
        // fail open
      }
    },
    async resetKey(key: string): Promise<void> {
      try {
        await redis.del(`${prefix}${key}`);
      } catch {
        // fail open
      }
    },
    async resetAll(): Promise<void> {
      // Not used in this app.
    },
    async shutdown(): Promise<void> {
      // No resources to release.
    },
  };
};

/**
 * Strict brute-force limiter for the admin login route: 5 failed attempts per
 * 15 minutes per IP. Admin accounts are the highest-value target, so this is
 * tighter than the player login limiter.
 */
export const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:auth:admin-login:"),
  message: {
    success: false,
    message: "Too many login attempts. Please try again in 15 minutes.",
  },
});

/**
 * Limiter for the public, unauthenticated guest-analytics ingest endpoint.
 * Events are batched client-side, so 60 batches/min per IP is generous for a
 * real visitor while capping abuse of an open write endpoint. Fails open.
 */
export const guestTrackRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisRateLimitStore("rl:track:guest:"),
  message: {
    success: false,
    message: "Too many requests.",
  },
});

/**
 * Limiter for adding, editing and deleting a child's profile. Keyed by the signed-in
 * user, not the IP, because families share addresses (a school, a mobile carrier)
 * and a limit per IP would throttle strangers together.
 *
 * 60 writes per 15 minutes is generous for a parent: a quiz save, a few edits and a
 * guidance write-back are a handful of requests. It exists to stop a loop in a client
 * or a script hammering the route, not to ration normal use. The child cap (10 per
 * parent) already bounds what a flood of POSTs can store; PUT and DELETE only reach
 * the caller's own children but are otherwise unbounded. Fails open when Redis is down.
 *
 * `store` is a parameter only so a test can pass an in-memory one: the Redis store
 * deliberately never blocks when Redis is off, which is exactly the test setup.
 */
export const createDependentsWriteRateLimiter = (
  store: Store = createRedisRateLimitStore("rl:dependents:write:")
) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || (req.ip ? ipKeyGenerator(req.ip) : "anon"),
    store,
    message: {
      success: false,
      message: "Too many changes to your children's profiles. Please try again in a few minutes.",
    },
  });

export const dependentsWriteRateLimiter = createDependentsWriteRateLimiter();
