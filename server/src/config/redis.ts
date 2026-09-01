import Redis from "ioredis";
import { bootFact, bootWarn } from "../utils/boot";
import { log as __rootLog } from "../utils/logger";
const log = __rootLog.child("redis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * REDIS_ENABLED=false is an explicit "Redis is deliberately off right now"
 * switch (ElastiCache stopped, no local Redis running, etc).
 *
 * Every Redis-backed code path already fails open on error — rate limiting,
 * auth-status caching, chat rate limits, socket.io fanout each has its own
 * `.catch()` — but that only matters once the failure is actually detected.
 * Without this switch, the general-purpose client below has no
 * `retryStrategy` override, so it falls back to ioredis's default: retry the
 * connection indefinitely with increasing backoff, and let a queued command
 * (`maxRetriesPerRequest: 3`) wait through several of those cycles before
 * finally rejecting. `apiRateLimitMiddleware` calls this client on every
 * single request ahead of every route, so that "eventually fails open" was
 * costing several seconds per request, on every request, whenever Redis was
 * unreachable.
 *
 * With the switch off, no connection is ever attempted (`lazyConnect`) and
 * any command issued while not connected rejects immediately
 * (`enableOfflineQueue: false`) rather than queuing and waiting — so the
 * existing fallbacks fire at effectively zero cost instead of a multi-second
 * timeout, with no changes needed at any of those call sites.
 */
const REDIS_ENABLED = process.env.REDIS_ENABLED !== "false";

const disabledClientOptions = {
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: () => null,
  maxRetriesPerRequest: 1,
} as const;

// ── General-purpose client (caching, presence, etc.) ─────────────────────────
const redis = new Redis(
  REDIS_URL,
  REDIS_ENABLED ? { maxRetriesPerRequest: 3 } : disabledClientOptions,
);

redis.on("connect", () => {
  bootFact("redis", "connected");
});

// An 'error' listener must always be attached — an unhandled 'error' event
// on an EventEmitter crashes the process. When Redis is deliberately
// disabled the error is expected on every call, so it's swallowed here
// rather than logged; every call site still handles the rejection itself.
redis.on("error", (err) => {
  if (REDIS_ENABLED) {
    log.warn("[redis] connection error:", err.message);
  }
});

if (!REDIS_ENABLED) {
  bootWarn(
    "Redis explicitly disabled (REDIS_ENABLED=false) — every Redis-backed feature falls back immediately",
  );
}

/**
 * Creates a dedicated pub/sub client pair for @socket.io/redis-adapter.
 * Called inside startServer() so errors are handled in the startup try/catch.
 * Two separate clients are required because a subscribed Redis client
 * cannot issue regular commands.
 *
 * retryStrategy: () => null — disables automatic reconnection so that if
 * Redis is not available, ioredis gives up immediately instead of flooding
 * the logs. The server falls back to single-instance mode in this case.
 *
 * Respects REDIS_ENABLED the same way as the general-purpose client above —
 * when disabled, server.ts's `pub.connect()`/`sub.connect()` calls at
 * startup reject immediately instead of attempting a connection.
 */
export const createRedisPubSub = () => {
  const noRetry = () => null; // tell ioredis: don't retry on disconnect

  const options = REDIS_ENABLED
    ? {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        retryStrategy: noRetry,
      }
    : disabledClientOptions;

  const pub = new Redis(REDIS_URL, options);
  const sub = new Redis(REDIS_URL, options);

  pub.on("error", (err) => {
    if (REDIS_ENABLED) {
      log.warn("[redis:pub] connection error:", err.message);
    }
  });
  sub.on("error", (err) => {
    if (REDIS_ENABLED) {
      log.warn("[redis:sub] connection error:", err.message);
    }
  });

  return { pub, sub };
};

export default redis;
