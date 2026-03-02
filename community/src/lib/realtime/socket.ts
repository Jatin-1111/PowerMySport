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

export const getCommunitySocket = (): Socket => {
  if (socket) {
    socket.auth = buildSocketAuth();
    return socket;
  }

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: false,
    auth: buildSocketAuth(),
  });

  return socket;
};
