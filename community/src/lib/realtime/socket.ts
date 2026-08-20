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
  });

  return socket;
};

/** Rooms this tab wants, kept so they can be replayed after a reconnect.
 *  Ref-counted: two components on one page can both want `blog:<id>` and the
 *  first to unmount must not unsubscribe the second. */
const subscribedRooms = new Map<string, number>();

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
