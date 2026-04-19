import { User } from "../models/User";
import { getNotificationSocket } from "../sockets/notificationSocket";

const WRITE_THROTTLE_MS = 60 * 1000;

// Map<userId, Set<socketId>> — each connected socket registers its own ID.
// A user is online as long as their set is non-empty. This eliminates the
// double-count problem when multiple namespaces (friends + presence) connect.
const activeSockets = new Map<string, Set<string>>();
const lastWriteAt = new Map<string, number>();

const shouldWriteNow = (userId: string): boolean => {
  const now = Date.now();
  const previous = lastWriteAt.get(userId) || 0;
  if (now - previous < WRITE_THROTTLE_MS) {
    return false;
  }
  lastWriteAt.set(userId, now);
  return true;
};

const persistLastActive = async (
  userId: string,
  force = false,
): Promise<void> => {
  if (!force && !shouldWriteNow(userId)) {
    return;
  }

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

export const markUserOnline = async (
  userId: string,
  socketId: string,
): Promise<void> => {
  let sockets = activeSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    activeSockets.set(userId, sockets);
  }
  sockets.add(socketId);
  await persistLastActive(userId);
  emitPresenceUpdate(userId, true);
};

export const markUserOffline = async (
  userId: string,
  socketId: string,
): Promise<void> => {
  const sockets = activeSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      activeSockets.delete(userId);
    }
  }

  const isStillOnline = (activeSockets.get(userId)?.size ?? 0) > 0;
  await persistLastActive(userId, true);
  emitPresenceUpdate(userId, isStillOnline);
};

export const touchUserLastActive = async (userId: string): Promise<void> => {
  await persistLastActive(userId);
};

export const isUserOnline = (userId: string): boolean => {
  return (activeSockets.get(userId)?.size ?? 0) > 0;
};
