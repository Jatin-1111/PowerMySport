import redis from "../../config/redis";
import { User } from "../../client/models/User";
import { getNotificationSocket } from "../../client/sockets/notificationSocket";

const WRITE_THROTTLE_MS = 60 * 1_000;
const PRESENCE_TTL_S    = 300; // 5-minute safety-net TTL per user key

// ── Helpers ───────────────────────────────────────────────────────────────────
const presenceKey = (userId: string) => `community:presence:${userId}`;

const lastWriteAt = new Map<string, number>(); // still in-memory — only used for DB write throttle

const shouldWriteNow = (userId: string): boolean => {
  const now = Date.now();
  const previous = lastWriteAt.get(userId) || 0;
  if (now - previous < WRITE_THROTTLE_MS) return false;
  lastWriteAt.set(userId, now);
  return true;
};

const persistLastActive = async (
  userId: string,
  force = false,
): Promise<void> => {
  if (!force && !shouldWriteNow(userId)) return;
  try {
    await User.updateOne(
      { _id: userId },
      { $set: { lastActiveAt: new Date() } },
    );
  } catch (error) {
    console.error("Failed to persist user lastActiveAt:", error);
  }
};

const emitPresenceUpdate = (userId: string, isOnlineNow: boolean): void => {
  const io = getNotificationSocket();
  if (!io) return;
  io.emit("PRESENCE_UPDATE", {
    userId,
    isOnlineNow,
    lastActiveAt: new Date().toISOString(),
  });
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called when a socket connects.
 * Registers the socket ID under the user's Redis presence hash and
 * resets the TTL so the key doesn't expire while the user is active.
 */
export const markUserOnline = async (
  userId: string,
  socketId: string,
): Promise<void> => {
  try {
    const key = presenceKey(userId);
    await redis.hset(key, socketId, "1");
    await redis.expire(key, PRESENCE_TTL_S);
  } catch (err) {
    console.error("[presence] markUserOnline redis error:", err);
  }
  await persistLastActive(userId);
  emitPresenceUpdate(userId, true);
};

/**
 * Called when a socket disconnects.
 * Removes only that socket's entry; the user stays online if they have
 * other open connections (e.g. two browser tabs).
 */
export const markUserOffline = async (
  userId: string,
  socketId: string,
): Promise<void> => {
  let isStillOnline = false;
  try {
    const key = presenceKey(userId);
    await redis.hdel(key, socketId);
    const remaining = await redis.hlen(key);
    isStillOnline = remaining > 0;
    if (!isStillOnline) {
      await redis.del(key); // clean up immediately — don't wait for TTL
    }
  } catch (err) {
    console.error("[presence] markUserOffline redis error:", err);
  }
  await persistLastActive(userId, true);
  emitPresenceUpdate(userId, isStillOnline);
};

/** Heartbeat — keeps the Redis key alive and throttles DB writes. */
export const touchUserLastActive = async (userId: string): Promise<void> => {
  try {
    const key = presenceKey(userId);
    // Refresh TTL so the key doesn't expire during long sessions
    await redis.expire(key, PRESENCE_TTL_S);
  } catch {
    // non-fatal
  }
  await persistLastActive(userId);
};

/** Returns true if the user has at least one active socket across any instance. */
export const isUserOnline = async (userId: string): Promise<boolean> => {
  try {
    const count = await redis.hlen(presenceKey(userId));
    return count > 0;
  } catch {
    return false;
  }
};

