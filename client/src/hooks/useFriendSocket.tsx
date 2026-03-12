"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { toast } from "sonner";

type FriendSocketContextType = {
  connected: boolean;
  pendingRequestCount: number;
  pendingBookingInvitationsCount: number;
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

// New unified notification type
type NotificationData = {
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: Date;
};

const FriendSocketContext = createContext<FriendSocketContextType>({
  connected: false,
  pendingRequestCount: 0,
  pendingBookingInvitationsCount: 0,
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
  const [pendingBookingInvitationsCount, setPendingBookingInvitationsCount] =
    useState(0);
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
      "Attempting to connect to friend socket at:",
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
      console.log("Friend socket connected successfully");
      setConnected(true);
    });

    // Listen for the unified notification event
    socketInstance.on("notification:new", (notification: NotificationData) => {
      console.log("New notification received:", notification);

      // Route based on notification type
      switch (notification.type) {
        case "FRIEND_REQUEST":
          setPendingRequestCount((prev) => prev + 1);
          toast.info(notification.message, {
            duration: 5000,
          });
          break;

        case "FRIEND_REQUEST_ACCEPTED":
          toast.success(notification.message, {
            duration: 5000,
          });
          break;

        case "FRIEND_REQUEST_DECLINED":
          toast.info(notification.message, {
            duration: 5000,
          });
          break;

        case "FRIEND_REMOVED":
          toast.info(notification.message, {
            duration: 5000,
          });
          break;

        case "BOOKING_INVITATION":
          setPendingBookingInvitationsCount((prev) => prev + 1);
          toast.info(notification.message, {
            duration: 7000,
            action: {
              label: "View",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/player/invitations";
                }
              },
            },
          });
          break;

        case "BOOKING_CONFIRMED":
          toast.success(notification.message, {
            duration: 7000,
            action: {
              label: "View",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/player/bookings";
                }
              },
            },
          });
          break;

        case "BOOKING_CANCELLED":
          toast.error(notification.message, {
            duration: 7000,
            action: {
              label: "View",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/player/bookings";
                }
              },
            },
          });
          break;

        case "BOOKING_STATUS_UPDATED":
          toast.info(notification.message, {
            duration: 7000,
            action: {
              label: "View",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/dashboard/my-bookings";
                }
              },
            },
          });
          break;

        case "REVIEW_POSTED":
          toast.info(notification.message, {
            duration: 6000,
            action: {
              label: "View",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              },
            },
          });
          break;

        case "COACH_VERIFICATION_VERIFIED":
          toast.success(notification.message, {
            duration: 8000,
            action: {
              label: "View Profile",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/coach/profile";
                }
              },
            },
          });
          break;

        case "COACH_VERIFICATION_REJECTED":
          toast.error(notification.message, {
            duration: 8000,
            action: {
              label: "View Details",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/coach/verification";
                }
              },
            },
          });
          break;

        case "COACH_VERIFICATION_REVIEW":
          toast.info(notification.message, {
            duration: 7000,
          });
          break;

        case "VENUE_APPROVAL_APPROVED":
          toast.success(notification.message, {
            duration: 8000,
            action: {
              label: "View Venue",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/venue-lister/venues";
                }
              },
            },
          });
          break;

        case "VENUE_APPROVAL_REJECTED":
          toast.error(notification.message, {
            duration: 8000,
            action: {
              label: "View Details",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/venue-lister/venues";
                }
              },
            },
          });
          break;

        case "VENUE_MARKED_FOR_REVIEW":
          toast.info(notification.message, {
            duration: 7000,
          });
          break;

        case "PAYMENT_CONFIRMED":
          toast.success(notification.message, {
            duration: 8000,
            action: {
              label: "View Booking",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/player/bookings";
                }
              },
            },
          });
          break;

        case "PAYMENT_FAILED":
          toast.error(notification.message, {
            duration: 9000,
            action: {
              label: "Try Again",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/player/bookings";
                }
              },
            },
          });
          break;

        case "PAYMENT_REFUND":
          toast.success(notification.message, {
            duration: 8000,
            action: {
              label: "View Details",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/player/bookings";
                }
              },
            },
          });
          break;

        case "PAYMENT_SPLIT_RECEIVED":
          toast.info(notification.message, {
            duration: 7000,
            action: {
              label: "View Booking",
              onClick: () => {
                if (typeof window !== "undefined") {
                  window.location.href = "/player/bookings";
                }
              },
            },
          });
          break;

        default:
          // Handle other notification types
          console.log("Unhandled notification type:", notification.type);
          break;
      }
    });

    // Keep legacy event listeners for backward compatibility (can be removed later)
    socketInstance.on(
      "friend:requestReceived",
      (data: FriendRequestReceivedData) => {
        console.log("Legacy friend request event:", data);
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
        console.log("Legacy friend request accepted event:", data);
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
        console.log("Legacy friend request declined event:", data);
        toast.info(`Your friend request was declined`, {
          duration: 5000,
        });
      },
    );

    socketInstance.on("friend:removed", (data: FriendRemovedData) => {
      console.log("Legacy friend removed event:", data);
      toast.info(
        `${data.removedBy?.name || "A user"} removed you as a friend`,
        {
          duration: 5000,
        },
      );
    });

    socketInstance.on("disconnect", () => {
      console.log("Friend socket disconnected");
      setConnected(false);
    });

    socketInstance.on("connect_error", (error) => {
      console.error("Friend socket connection error:", error.message);
      console.error("Error details:", error);
      setConnected(false);
    });

    setSocket(socketInstance);

    // Dedicated presence socket — connects a lightweight channel so the
    // server can track this user as online/offline for every device and
    // page, not just when the /friends namespace is active.
    const presenceSocket = io(`${SOCKET_URL}/presence`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
    });

    return () => {
      console.log("Disconnecting friend socket");
      socketInstance.disconnect();
      presenceSocket.disconnect();
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
      value={{
        connected,
        pendingRequestCount,
        pendingBookingInvitationsCount,
        refreshFriends,
      }}
    >
      {children}
    </FriendSocketContext.Provider>
  );
}
