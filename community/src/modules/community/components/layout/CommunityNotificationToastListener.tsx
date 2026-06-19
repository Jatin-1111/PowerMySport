"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { toast } from "@/lib/toast";

type IncomingNotificationData = {
  event?: string;
  postId?: string;
  conversationId?: string;
  groupId?: string;
};

type IncomingNotification = {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  timestamp?: string;
  data?: IncomingNotificationData;
};

const buildActionHref = (payload: IncomingNotification): string | null => {
  if (payload.data?.postId) {
    return `/q/${payload.data.postId}`;
  }

  if (payload.data?.conversationId) {
    return `/chats?sidebar=inbox&conversation=${encodeURIComponent(payload.data.conversationId)}`;
  }

  if (payload.data?.groupId) {
    return `/chats?group=${encodeURIComponent(payload.data.groupId)}`;
  }

  return null;
};

export default function CommunityNotificationToastListener() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastToastKeyRef = useRef("");

  useEffect(() => {
    const socket = getCommunitySocket();

    const handleNotification = (payload: IncomingNotification) => {
      if (!payload || pathname === "/notifications") {
        return;
      }

      // Suppress toast if we are already viewing this conversation/group in the UI
      const activeConversation = searchParams?.get("conversation");
      if (
        activeConversation &&
        payload.data?.conversationId === activeConversation
      ) {
        return;
      }

      const activeGroup = searchParams?.get("group");
      if (activeGroup && payload.data?.groupId === activeGroup) {
        return;
      }

      const title = payload.title?.trim() || "New community notification";
      const message = payload.message?.trim() || "You have a new update";
      const actionHref = buildActionHref(payload);
      const toastKey = [
        payload.id || "",
        payload.type || "",
        payload.timestamp || "",
        title,
        message,
      ].join("|");

      if (toastKey && lastToastKeyRef.current === toastKey) {
        return;
      }
      lastToastKeyRef.current = toastKey;

      toast(title, {
        description: message,
        duration: 3200,
        action: actionHref
          ? {
              label: "Open",
              onClick: () => router.push(actionHref),
            }
          : undefined,
      });
    };

    socket.on("notification:new", handleNotification);
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", handleNotification);
    };
  }, [pathname, searchParams, router]);

  return null;
}
