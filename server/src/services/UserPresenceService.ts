import { User } from "../models/User";
import { getNotificationSocket } from "../sockets/notificationSocket";

const WRITE_THROTTLE_MS = 60 * 1000;

const activeSocketCounts = new Map<string, number>();
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

  await User.updateOne({ _id: userId }, { $set: { lastActiveAt: new Date() } });
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

export const markUserOnline = async (userId: string): Promise<void> => {
  const count = activeSocketCounts.get(userId) || 0;
  activeSocketCounts.set(userId, count + 1);
  await persistLastActive(userId);
  emitPresenceUpdate(userId, true);
};

export const markUserOffline = async (userId: string): Promise<void> => {
  const count = activeSocketCounts.get(userId) || 0;
  const next = Math.max(0, count - 1);

  if (next === 0) {
    activeSocketCounts.delete(userId);
  } else {
    activeSocketCounts.set(userId, next);
  }

  await persistLastActive(userId, true);
  emitPresenceUpdate(userId, next > 0);
};

export const touchUserLastActive = async (userId: string): Promise<void> => {
  await persistLastActive(userId);
};

export const isUserOnline = (userId: string): boolean => {
  return (activeSocketCounts.get(userId) || 0) > 0;
};
