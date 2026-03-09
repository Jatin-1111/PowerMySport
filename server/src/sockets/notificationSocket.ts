import { Server as SocketIOServer } from "socket.io";
import { ReminderMonitoringService } from "../services/ReminderMonitoringService";

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
