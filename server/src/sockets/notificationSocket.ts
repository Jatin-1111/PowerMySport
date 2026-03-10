import { Server as SocketIOServer, Socket } from "socket.io";
import { ReminderMonitoringService } from "../services/ReminderMonitoringService";
import {
  markUserOffline,
  markUserOnline,
  touchUserLastActive,
} from "../services/UserPresenceService";
import { verifyToken } from "../utils/jwt";

let notificationSocketIO: SocketIOServer | null = null;

/**
 * Set up the notification monitoring WebSocket
 */
export const setupNotificationSocket = (io: SocketIOServer) => {
  notificationSocketIO = io;

  io.on("connection", (socket) => {
    console.log(`📡 Notification monitoring client connected: ${socket.id}`);

    // Send initial stats on connection
    ReminderMonitoringService.getMonitoringStats()
      .then((stats) => {
        socket.emit("REMINDER_STATS_UPDATE", {
          type: "REMINDER_STATS_UPDATE",
          stats,
        });
      })
      .catch((err) => {
        console.error("Failed to send initial stats:", err);
      });

    ReminderMonitoringService.checkSchedulerHealth()
      .then((health) => {
        socket.emit("HEALTH_UPDATE", { type: "HEALTH_UPDATE", health });
      })
      .catch((err) => {
        console.error("Failed to send health update:", err);
      });

    socket.on("disconnect", () => {
      console.log(
        `📡 Notification monitoring client disconnected: ${socket.id}`,
      );
    });
  });
};

/**
 * Broadcast reminder stats update to all connected clients
 */
export const broadcastStatsUpdate = async () => {
  if (!notificationSocketIO) {
    return;
  }

  try {
    const stats = await ReminderMonitoringService.getMonitoringStats();
    notificationSocketIO.emit("REMINDER_STATS_UPDATE", {
      type: "REMINDER_STATS_UPDATE",
      stats,
    });
  } catch (error) {
    console.error("Failed to broadcast stats update:", error);
  }
};

/**
 * Broadcast health status update to all connected clients
 */
export const broadcastHealthUpdate = async () => {
  if (!notificationSocketIO) {
    return;
  }

  try {
    const health = await ReminderMonitoringService.checkSchedulerHealth();
    notificationSocketIO.emit("HEALTH_UPDATE", {
      type: "HEALTH_UPDATE",
      health,
    });
  } catch (error) {
    console.error("Failed to broadcast health update:", error);
  }
};

/**
 * Get the notification socket instance
 */
export const getNotificationSocket = (): SocketIOServer | null => {
  return notificationSocketIO;
};

// ---------------------------------------------------------------------------
// /presence namespace — lightweight user presence tracking.
// Any authenticated client that connects here is marked online; on disconnect
// they are marked offline.  This is separate from /friends so that presence
// works for every logged-in user regardless of which features they use.
// ---------------------------------------------------------------------------

const getPresenceUserId = (socket: Socket): string | null => {
  const authToken = (
    socket.handshake.auth?.token as string | undefined
  )?.trim();
  const bearerToken = (
    socket.handshake.headers.authorization as string | undefined
  )
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  const cookieHeader = socket.handshake.headers.cookie;
  let cookieToken: string | null = null;
  if (cookieHeader) {
    for (const piece of cookieHeader.split(";")) {
      const [rawKey, ...rest] = piece.split("=");
      if (rawKey?.trim() === "token") {
        cookieToken = rest.join("=").trim() || null;
        break;
      }
    }
  }

  const candidates = [authToken, bearerToken, cookieToken].filter(
    (t): t is string => Boolean(t),
  );

  for (const token of candidates) {
    try {
      const payload = verifyToken(token);
      return payload.id;
    } catch {
      // try next candidate
    }
  }

  return null;
};

export const setupPresenceSocket = (io: SocketIOServer): void => {
  const presenceNs = io.of("/presence");

  presenceNs.use((socket, next) => {
    const userId = getPresenceUserId(socket);
    if (!userId) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.userId = userId;
    next();
  });

  presenceNs.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    await markUserOnline(userId);

    // Keep lastActiveAt fresh while the tab is open
    const heartbeat = setInterval(() => {
      touchUserLastActive(userId).catch(() => {});
    }, 30_000);

    socket.on("disconnect", () => {
      clearInterval(heartbeat);
      markUserOffline(userId).catch(() => {});
    });
  });
};
