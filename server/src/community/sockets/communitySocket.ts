import { Server, Socket } from "socket.io";
import { CommunityService } from "../services/CommunityService";
import {
  markUserOffline,
  markUserOnline,
  touchUserLastActive,
} from "../../shared/services/UserPresenceService";
import { isTokenRevoked, verifyToken } from "../../utils/jwt";

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

const getSocketUserId = async (socket: Socket): Promise<string | null> => {
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
      if (await isTokenRevoked(payload.jti)) {
        continue;
      }
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
    const userId = await getSocketUserId(socket);
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

    socket.on("community:joinGroupRoom", (groupId) => {
      if (groupId) {
        socket.join(`group:${groupId}`);
      }
    });

    socket.on("community:leaveGroupRoom", (groupId) => {
      if (groupId) {
        socket.leave(`group:${groupId}`);
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
          communityNamespace
            .to(`conversation:${conversationId}`)
            .emit("community:messagesRead", {
              conversationId,
              readerId: userId,
              messageIds: result.messageIds,
            });

          for (const participantId of result.participantIds) {
            communityNamespace
              .to(`user:${participantId}`)
              .emit("community:conversationUpdated", {
                conversationId,
              });
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

    socket.on("community:typingStart", async (payload, callback) => {
      try {
        const allowed = consumeRateLimit(
          socketRateLimit,
          "community:typingStart",
          10,
          2000,
        );
        if (!allowed) return;

        const conversationId = payload?.conversationId;
        if (!conversationId) return;

        communityNamespace
          .to(`conversation:${conversationId}`)
          .emit("community:userTyping", {
            conversationId,
            userId,
            isTyping: true,
          });

        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        // Silently ignore typing errors
      }
    });

    socket.on("community:typingStop", async (payload, callback) => {
      try {
        const allowed = consumeRateLimit(
          socketRateLimit,
          "community:typingStop",
          10,
          2000,
        );
        if (!allowed) return;

        const conversationId = payload?.conversationId;
        if (!conversationId) return;

        communityNamespace
          .to(`conversation:${conversationId}`)
          .emit("community:userTyping", {
            conversationId,
            userId,
            isTyping: false,
          });

        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        // Silently ignore typing errors
      }
    });

    socket.on(
      "community:markConversationAsDelivered",
      async (payload, callback) => {
        try {
          const allowed = consumeRateLimit(
            socketRateLimit,
            "community:markConversationAsDelivered",
            60,
            10_000,
          );
          if (!allowed) {
            const message = "Too many read requests, please slow down";
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

          const result = await CommunityService.markConversationDelivered(
            userId,
            conversationId,
          );

          if (result.messageIds.length) {
            communityNamespace
              .to(`conversation:${conversationId}`)
              .emit("community:messagesDelivered", {
                conversationId,
                readerId: userId,
                messageIds: result.messageIds,
              });
          }

          if (typeof callback === "function") {
            callback({ success: true, data: result });
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to mark messages as delivered";
          socket.emit("community:error", { message });
          if (typeof callback === "function") {
            callback({ success: false, message });
          }
        }
      },
    );

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
        const rawType = payload?.type;
        const messageType: "TEXT" | "IMAGE" =
          rawType === "IMAGE" ? "IMAGE" : "TEXT";
        const metadata:
          | { width?: number; height?: number; caption?: string }
          | undefined =
          messageType === "IMAGE" && payload?.metadata
            ? {
                width:
                  typeof payload.metadata.width === "number"
                    ? payload.metadata.width
                    : undefined,
                height:
                  typeof payload.metadata.height === "number"
                    ? payload.metadata.height
                    : undefined,
                caption:
                  typeof payload.metadata.caption === "string"
                    ? payload.metadata.caption.substring(0, 2000)
                    : undefined,
              }
            : undefined;

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
          { type: messageType, ...(metadata ? { metadata } : {}) },
        );

        communityNamespace
          .to(`conversation:${conversationId}`)
          .emit("community:newMessage", message);

        for (const participantId of message.participantIds) {
          communityNamespace
            .to(`user:${participantId}`)
            .emit("community:conversationUpdated", {
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

        communityNamespace
          .to(`conversation:${updated.conversationId}`)
          .emit("community:messageEdited", updated);

        for (const participantId of updated.participantIds) {
          communityNamespace
            .to(`user:${participantId}`)
            .emit("community:conversationUpdated", {
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

        communityNamespace
          .to(`conversation:${deleted.conversationId}`)
          .emit("community:messageDeleted", deleted);

        for (const participantId of deleted.participantIds) {
          communityNamespace
            .to(`user:${participantId}`)
            .emit("community:conversationUpdated", {
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
        console.error(
          "Failed to persist community last seen on disconnect:",
          error,
        );
      }
    });
  });
};
