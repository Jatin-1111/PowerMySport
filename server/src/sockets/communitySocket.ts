import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { CommunityService } from "../services/CommunityService";
import { verifyToken } from "../utils/jwt";

const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/$/, "").toLowerCase();

const configuredOrigins = [
  process.env.FRONTEND_URLS,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "https://powermysport.com",
  "https://www.powermysport.com",
  "https://admin.powermysport.com",
  "https://community.powermysport.com",
]
  .filter(Boolean)
  .flatMap((value) => (value as string).split(","))
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);
const allowedOriginPatterns = [
  /^https:\/\/([a-z0-9-]+\.)*powermysport\.com$/i,
  /^http:\/\/localhost:\d+$/i,
];

const isOriginAllowed = (origin: string): boolean => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  return allowedOriginPatterns.some((pattern) =>
    pattern.test(normalizedOrigin),
  );
};

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

export const initializeCommunitySocket = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed"));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
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

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    await CommunityService.touchLastSeen(userId);

    socket.join(`user:${userId}`);

    try {
      const conversations = await CommunityService.listConversations(userId);
      for (const conversation of conversations) {
        socket.join(`conversation:${conversation.id}`);
      }
    } catch {
      // no-op: socket can still join lazily when conversation is opened
    }

    socket.on("community:joinConversation", async (payload) => {
      try {
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
          io.to(`user:${participantId}`).emit("community:newMessage", message);
        }

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

    socket.on("disconnect", async () => {
      await CommunityService.touchLastSeen(userId);
    });
  });

  return io;
};
