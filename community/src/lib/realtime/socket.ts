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

export const getCommunitySocket = (): Socket => {
  if (socket) {
    socket.auth = buildSocketAuth();
    return socket;
  }

  const socketUrl = resolveSocketUrl();

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: false,
    auth: buildSocketAuth(),
  });

  return socket;
};
