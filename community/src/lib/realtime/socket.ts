import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const getAuthToken = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("token");
};

const buildSocketAuth = (): { token?: string } => {
  const token = getAuthToken();
  return token ? { token } : {};
};

const resolveSocketUrl = (): string => {
  const explicitSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicitSocketUrl) {
    return explicitSocketUrl;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/?api\/?$/i, "").replace(/\/$/, "");
  }

  return "http://localhost:5000";
};

const resolveCommunityNamespaceUrl = (): string => {
  const baseUrl = resolveSocketUrl().replace(/\/+$/, "");
  if (/\/community$/i.test(baseUrl)) {
    return baseUrl;
  }

  return `${baseUrl}/community`;
};

export const getCommunitySocket = (): Socket => {
  if (socket) {
    socket.auth = buildSocketAuth();
    return socket;
  }

  const socketUrl = resolveCommunityNamespaceUrl();

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: false,
    auth: buildSocketAuth(),
  });

  // Server-side room membership does not survive a reconnect — the socket comes
  // back with a new id and an empty room set. Without this replay a user whose
  // wifi blipped would sit on the Q&A feed receiving nothing at all, which is a
  // worse failure than the old broadcast-to-everyone: silent, and only on the
  // connections least likely to notice.
  socket.on("connect", () => {
    for (const room of subscribedRooms) {
      socket?.emit("community:subscribe", room);
    }
    for (const conversationId of activeConversationRooms) {
      socket?.emit("community:joinConversation", { conversationId });
    }
  });

  return socket;
};

/** Rooms this tab wants, kept so they can be replayed after a reconnect.
 *  Ref-counted: two components on one page can both want `blog:<id>` and the
 *  first to unmount must not unsubscribe the second. */
const subscribedRooms = new Map<string, number>();

/** Conversation rooms this tab has joined, replayed on reconnect the same way
 *  as subscribedRooms above. The server also auto-joins a socket's 30 most
 *  recent conversations on connect, so this is belt-and-suspenders for
 *  conversations outside that window (e.g. one just created this session) —
 *  not the only path to correct room membership. There's no server-side
 *  "leave conversation" event, so unlike subscribedRooms this only grows for
 *  the life of the tab; that's a small, bounded set of ids, not a leak. */
const activeConversationRooms = new Set<string>();

export const QNA_FEED_ROOM = "qna:feed";
export const BLOG_FEED_ROOM = "blog:feed";
export const qnaPostRoom = (postId: string) => `qna:post:${postId}`;
export const blogRoom = (blogId: string) => `blog:${blogId}`;

/**
 * Join a public Q&A/blog room for as long as the caller needs it. Returns the
 * matching unsubscribe — call it from the effect cleanup.
 */
export const subscribeToCommunityRoom = (room: string): (() => void) => {
  const activeSocket = getCommunitySocket();
  const previous = subscribedRooms.get(room) ?? 0;
  subscribedRooms.set(room, previous + 1);

  if (previous === 0 && activeSocket.connected) {
    activeSocket.emit("community:subscribe", room);
  }

  if (!activeSocket.connected) {
    // The `connect` handler above replays everything in the map, so a room
    // added while offline is joined as soon as the socket comes up.
    activeSocket.connect();
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;

    const current = subscribedRooms.get(room) ?? 0;
    if (current <= 1) {
      subscribedRooms.delete(room);
      if (activeSocket.connected) {
        activeSocket.emit("community:unsubscribe", room);
      }
      return;
    }

    subscribedRooms.set(room, current - 1);
  };
};

/**
 * Join a conversation's message room, replayed automatically on reconnect.
 * Safe to call repeatedly for the same conversation (join is idempotent
 * server-side); callers don't need to track whether they've already joined.
 */
export const joinConversationRoom = (conversationId: string): void => {
  if (!conversationId) {
    return;
  }

  activeConversationRooms.add(conversationId);
  const activeSocket = getCommunitySocket();
  if (activeSocket.connected) {
    activeSocket.emit("community:joinConversation", { conversationId });
  } else {
    // The `connect` handler above replays everything in the set, so a
    // conversation joined while offline is joined as soon as the socket
    // comes up.
    activeSocket.connect();
  }
};
