import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getCommunitySocket = (): Socket => {
  if (socket) {
    return socket;
  }

  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

  socket = io(socketUrl, {
    transports: ["websocket", "polling"],
    withCredentials: true,
  });

  return socket;
};
