import { Server, Socket } from "socket.io";
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

export const setupFriendSocket = (io: Server): void => {
  // Use /friends namespace for friend notifications
  const friendsNamespace = io.of("/friends");

  console.log("🔧 Setting up /friends namespace");

  friendsNamespace.use(async (socket, next) => {
    const userId = getSocketUserId(socket);
    if (!userId) {
      console.log("❌ Friend socket auth failed: No userId found");
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.userId = userId;
    console.log(`✅ Friend socket auth success: User ${userId}`);
    next();
  });

  friendsNamespace.on("connection", async (socket) => {
    const userId = socket.data.userId as string;

    // Join user's personal room for receiving friend notifications
    socket.join(`user:${userId}`);

    console.log(`👥 Friend socket connected: User ${userId}`);

    socket.on("disconnect", () => {
      console.log(`👥 Friend socket disconnected: User ${userId}`);
    });
  });

  console.log("✅ /friends namespace setup complete");
};

// Export a singleton instance that will be set during server initialization
let friendSocketInstance: Server | null = null;

export const setFriendSocketInstance = (io: Server) => {
  friendSocketInstance = io;
};

export const getFriendSocketInstance = (): Server | null => {
  return friendSocketInstance;
};

// Notification helper functions
export const notifyFriendRequest = (
  recipientId: string,
  data: {
    requestId: string;
    requester: {
      id: string;
      name: string;
      email: string;
      photoUrl?: string | undefined;
    };
  },
) => {
  if (!friendSocketInstance) return;

  friendSocketInstance
    .of("/friends")
    .to(`user:${recipientId}`)
    .emit("friend:requestReceived", {
      requestId: data.requestId,
      requester: data.requester,
      timestamp: new Date().toISOString(),
    });
};

export const notifyFriendRequestAccepted = (
  requesterId: string,
  data: {
    acceptedBy: {
      id: string;
      name: string;
      email: string;
      photoUrl?: string | undefined;
    };
  },
) => {
  if (!friendSocketInstance) return;

  friendSocketInstance
    .of("/friends")
    .to(`user:${requesterId}`)
    .emit("friend:requestAccepted", {
      friend: data.acceptedBy,
      timestamp: new Date().toISOString(),
    });
};

export const notifyFriendRequestDeclined = (
  requesterId: string,
  data: {
    declinedBy: {
      id: string;
      name: string;
    };
  },
) => {
  if (!friendSocketInstance) return;

  friendSocketInstance
    .of("/friends")
    .to(`user:${requesterId}`)
    .emit("friend:requestDeclined", {
      userId: data.declinedBy.id,
      userName: data.declinedBy.name,
      timestamp: new Date().toISOString(),
    });
};

export const notifyFriendRemoved = (
  userId: string,
  data: {
    removedBy: {
      id: string;
      name: string;
    };
  },
) => {
  if (!friendSocketInstance) return;

  friendSocketInstance
    .of("/friends")
    .to(`user:${userId}`)
    .emit("friend:removed", {
      removedBy: data.removedBy,
      timestamp: new Date().toISOString(),
    });
};
