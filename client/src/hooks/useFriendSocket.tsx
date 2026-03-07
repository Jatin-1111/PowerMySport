"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { toast } from "sonner";

type FriendSocketContextType = {
  connected: boolean;
  pendingRequestCount: number;
  refreshFriends: () => void;
};

type FriendRequestReceivedData = {
  requester?: { name: string; id: string };
};

type FriendRequestAcceptedData = {
  friend?: { name: string; id: string };
};

type FriendRequestDeclinedData = {
  requesterId: string;
};

type FriendRemovedData = {
  removedBy?: { name: string; id: string };
};

const FriendSocketContext = createContext<FriendSocketContextType>({
  connected: false,
  pendingRequestCount: 0,
  refreshFriends: () => {},
});

export const useFriendSocket = () => useContext(FriendSocketContext);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
// Socket.IO namespaces are at root level, strip /api if present
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

export function FriendSocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
      }
      return;
    }

    console.log("Connecting friend socket for user:", user.id);

    // Get token from localStorage or cookie
    const getToken = () => {
      if (typeof window !== "undefined") {
        return (
          localStorage.getItem("token") ||
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("token="))
            ?.split("=")[1]
        );
      }
      return null;
    };

    const token = getToken();
    if (!token) {
      console.warn("No authentication token found for socket connection");
      return;
    }

    console.log(
      "🔌 Attempting to connect to friend socket at:",
      `${SOCKET_URL}/friends`,
    );

    const socketInstance = io(`${SOCKET_URL}/friends`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketInstance.on("connect", () => {
      console.log("✅ Friend socket connected successfully");
      setConnected(true);
    });

    socketInstance.on(
      "friend:requestReceived",
      (data: FriendRequestReceivedData) => {
        console.log("New friend request:", data);
        setPendingRequestCount((prev) => prev + 1);
        toast.info(
          `${data.requester?.name || "Someone"} sent you a friend request!`,
          {
            duration: 5000,
          },
        );
      },
    );

    socketInstance.on(
      "friend:requestAccepted",
      (data: FriendRequestAcceptedData) => {
        console.log("Friend request accepted:", data);
        toast.success(
          `${data.friend?.name || "User"} accepted your friend request!`,
          {
            duration: 5000,
          },
        );
      },
    );

    socketInstance.on(
      "friend:requestDeclined",
      (data: FriendRequestDeclinedData) => {
        console.log("Friend request declined:", data);
        toast.info(`Your friend request was declined`, {
          duration: 5000,
        });
      },
    );

    socketInstance.on("friend:removed", (data: FriendRemovedData) => {
      console.log("Friend removed:", data);
      toast.info(
        `${data.removedBy?.name || "A user"} removed you as a friend`,
        {
          duration: 5000,
        },
      );
    });

    socketInstance.on("disconnect", () => {
      console.log("❌ Friend socket disconnected");
      setConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("❌ Friend socket connection error:", error.message);
      console.error("Error details:", error);
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      console.log("Disconnecting friend socket");
      socketInstance.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refreshFriends = () => {
    // Trigger a refresh of friend data
    console.log("Refreshing friends...");
    // You can emit an event or dispatch an action here to reload friends
    if (socket && connected) {
      socket.emit("friend:refresh");
    }
  };

  return (
    <FriendSocketContext.Provider
      value={{ connected, pendingRequestCount, refreshFriends }}
    >
      {children}
    </FriendSocketContext.Provider>
  );
}
