import { Server, Socket } from "socket.io";
import { CommunityService } from "../services/CommunityService";
import {
  markUserOffline,
  markUserOnline,
  touchUserLastActive,
} from "../services/UserPresenceService";
import { verifyToken } from "../utils/jwt";

const extractTokenFromCookie = (cookieHeader?: string): string | null => {
  if (!cookieHeader) {
    return null;
  }

  const pieces = cookieHeader.split(";");
  for (const piece of pieces) {
    const [rawKey, ...rest] = piece.split("=");
    const key = rawKey?.trim();
    if (key === "token") {
      return rest.join("=").trim();
    }
  }

  return null;
};

const getSocketUserId = (socket: Socket): string | null => {
  const authToken = (
    socket.handshake.auth?.token as string | undefined
  )?.trim();
  const bearerToken = (
    socket.handshake.headers.authorization as string | undefined
  )
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  const cookieToken = extractTokenFromCookie(socket.handshake.headers.cookie);

  const candidates = [authToken, bearerToken, cookieToken].filter(
    (token): token is string => Boolean(token),
  );

  for (const token of candidates) {
    try {
      const payload = verifyToken(token);
      return payload.id;
    } catch {
      // Try next token source
    }
  }

  return null;
};

type RateLimitState = {
  windowStart: number;
  count: number;
};

const consumeRateLimit = (
  state: Map<string, RateLimitState>,
  key: string,
  limit: number,
  windowMs: number,
): boolean => {
  const now = Date.now();
  const current = state.get(key);

  if (!current || now - current.windowStart > windowMs) {
    state.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (current.count >= limit) {
    return false;
  }

  current.count += 1;
  state.set(key, current);
  return true;
};

export const setupCommunitySocket = (io: Server): void => {
  // Use /community namespace for community features
  const communityNamespace = io.of("/community");

  communityNamespace.use(async (socket, next) => {
    const userId = getSocketUserId(socket);
    if (!userId) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      await CommunityService.getMyProfile(userId);
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  communityNamespace.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    const socketRateLimit = new Map<string, RateLimitState>();
    try {
      await CommunityService.touchLastSeen(userId);
      await markUserOnline(userId, socket.id);
    } catch (error) {
      console.error("Failed to initialize community socket presence:", error);
    }

    const heartbeat = setInterval(() => {
      touchUserLastActive(userId).catch((error: unknown) => {
        console.error("Failed to persist community socket heartbeat:", error);
      });
    }, 60_000);

    socket.join(`user:${userId}`);

    try {
      const recentConversationIds =
        await CommunityService.listRecentConversationIdsForRealtime(userId, 30);
      for (const conversationId of recentConversationIds) {
        socket.join(`conversation:${conversationId}`);
      }
    } catch {
      // no-op: socket can still join lazily when conversation is opened
    }

    socket.on("community:joinConversation", async (payload) => {
      try {
        const allowed = consumeRateLimit(
          socketRateLimit,
          "community:joinConversation",
          60,
          10_000,
        );
        if (!allowed) {
          socket.emit("community:error", {
            message: "Too many join requests, please slow down",
          });
          return;
        }

        const conversationId = String(payload?.conversationId || "");
        if (!conversationId) {
          socket.emit("community:error", {
            message: "conversationId is required",
          });
          return;
        }

        await CommunityService.assertConversationAccess(userId, conversationId);
        socket.join(`conversation:${conversationId}`);
      } catch (error) {
        socket.emit("community:error", {
          message:
            error instanceof Error
              ? error.message
              : "Failed to join conversation",
        });
      }
    });

    socket.on("community:markRead", async (payload, callback) => {
      try {
        const allowed = consumeRateLimit(
          socketRateLimit,
          "community:markRead",
          80,
          10_000,
        );
        if (!allowed) {
          const message = "Too many read updates, please slow down";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const conversationId = String(payload?.conversationId || "");
        if (!conversationId) {
          const message = "conversationId is required";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const result = await CommunityService.markConversationRead(
          userId,
          conversationId,
        );

        if (result.messageIds.length) {
          io.to(`conversation:${conversationId}`).emit(
            "community:messagesRead",
            {
              conversationId,
              readerId: userId,
              messageIds: result.messageIds,
            },
          );

          for (const participantId of result.participantIds) {
            io.to(`user:${participantId}`).emit(
              "community:conversationUpdated",
              {
                conversationId,
              },
            );
          }
        }

        if (typeof callback === "function") {
          callback({ success: true, data: result });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to mark messages as read";
        socket.emit("community:error", { message });
        if (typeof callback === "function") {
          callback({ success: false, message });
        }
      }
    });

    socket.on("community:sendMessage", async (payload, callback) => {
      try {
        const allowed = consumeRateLimit(
          socketRateLimit,
          "community:sendMessage",
          30,
          10_000,
        );
        if (!allowed) {
          const message = "Too many messages sent, please slow down";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const conversationId = String(payload?.conversationId || "");
        const content = String(payload?.content || "").trim();

        if (!conversationId || !content) {
          const message = "conversationId and content are required";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const message = await CommunityService.sendMessage(
          userId,
          conversationId,
          content,
        );

        io.to(`conversation:${conversationId}`).emit(
          "community:newMessage",
          message,
        );

        for (const participantId of message.participantIds) {
          io.to(`user:${participantId}`).emit("community:conversationUpdated", {
            conversationId,
            conversationType: message.conversationType || "DM",
          });
        }

        if (typeof callback === "function") {
          callback({ success: true, data: message });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send message";
        socket.emit("community:error", {
          message,
        });
        if (typeof callback === "function") {
          callback({ success: false, message });
        }
      }
    });

    socket.on("community:editMessage", async (payload, callback) => {
      try {
        const allowed = consumeRateLimit(
          socketRateLimit,
          "community:editMessage",
          20,
          10_000,
        );
        if (!allowed) {
          const message = "Too many message edits, please slow down";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const messageId = String(payload?.messageId || "");
        const content = String(payload?.content || "").trim();

        if (!messageId || !content) {
          const message = "messageId and content are required";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const updated = await CommunityService.editMessage(
          userId,
          messageId,
          content,
        );

        io.to(`conversation:${updated.conversationId}`).emit(
          "community:messageEdited",
          updated,
        );

        for (const participantId of updated.participantIds) {
          io.to(`user:${participantId}`).emit("community:conversationUpdated", {
            conversationId: updated.conversationId,
            conversationType: updated.conversationType || "DM",
          });
        }

        if (typeof callback === "function") {
          callback({ success: true, data: updated });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to edit message";
        socket.emit("community:error", { message });
        if (typeof callback === "function") {
          callback({ success: false, message });
        }
      }
    });

    socket.on("community:deleteMessage", async (payload, callback) => {
      try {
        const allowed = consumeRateLimit(
          socketRateLimit,
          "community:deleteMessage",
          20,
          10_000,
        );
        if (!allowed) {
          const message = "Too many message deletes, please slow down";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const messageId = String(payload?.messageId || "");
        if (!messageId) {
          const message = "messageId is required";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
          return;
        }

        const deleted = await CommunityService.deleteMessage(userId, messageId);

        io.to(`conversation:${deleted.conversationId}`).emit(
          "community:messageDeleted",
          deleted,
        );

        for (const participantId of deleted.participantIds) {
          io.to(`user:${participantId}`).emit("community:conversationUpdated", {
            conversationId: deleted.conversationId,
            conversationType: deleted.conversationType || "DM",
          });
        }

        if (typeof callback === "function") {
          callback({ success: true, data: deleted });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete message";
        socket.emit("community:error", { message });
        if (typeof callback === "function") {
          callback({ success: false, message });
        }
      }
    });

    socket.on("disconnect", async () => {
      clearInterval(heartbeat);
      try {
        await markUserOffline(userId, socket.id);
      } catch (error) {
        console.error("Failed to mark community user offline:", error);
      }

      try {
        await CommunityService.touchLastSeen(userId);
      } catch (error) {
        console.error("Failed to persist community last seen on disconnect:", error);
      }
    });
  });
};
