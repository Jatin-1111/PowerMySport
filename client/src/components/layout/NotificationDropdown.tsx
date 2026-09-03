"use client";

import { notificationApi, type Notification } from "@/lib/api/notification";
import { getCommunityAppUrl } from "@/lib/community/url";
import { cn } from "@/utils/cn";
import { formatDistanceToNow } from "@/utils/date";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Calendar,
  Check,
  CreditCard,
  MessageCircle,
  Settings,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface NotificationDropdownProps {
  className?: string;
}

// Maps a notification to the URL it should navigate to when clicked.
function getNotificationLink(notification: Notification): string {
  const data = notification.data || {};
  const event = data.event as string | undefined;

  switch (notification.type) {
    case "MESSAGE_RECEIVED": {
      if (event === "COMMUNITY_MESSAGE_RECEIVED") {
        const conversationId = data.conversationId as string | undefined;
        return getCommunityAppUrl({
          path: "chats",
          searchParams: conversationId ? { conversation: conversationId } : {},
        });
      }
      if (event === "COMMUNITY_ANSWER_CREATED") {
        const postId = data.postId as string | undefined;
        return postId
          ? getCommunityAppUrl({ path: `q/${postId}` })
          : getCommunityAppUrl({ path: "q" });
      }
      if (event === "COMMUNITY_UPVOTE_RECEIVED") {
        const postId = data.postId as string | undefined;
        return postId
          ? getCommunityAppUrl({ path: `q/${postId}` })
          : getCommunityAppUrl({ path: "q" });
      }
      return getCommunityAppUrl({ path: "chats" });
    }
    case "FRIEND_REQUEST":
    case "FRIEND_REQUEST_ACCEPTED":
    case "FRIEND_REQUEST_DECLINED":
    case "FRIEND_REMOVED":
      return "/dashboard/my-profile";
    case "BOOKING_INVITATION":
    case "BOOKING_CONFIRMED":
    case "BOOKING_CANCELLED":
    case "BOOKING_STATUS_UPDATED":
    case "BOOKING_REMINDER":
    case "INVITATION_EXPIRY":
      return "/dashboard";
    case "SESSION_MOM_ADDED": {
      const sessionId = data.sessionId as string | undefined;
      return sessionId ? `/experts/sessions/${sessionId}` : "/experts/sessions";
    }
    case "SESSION_MOM_REMINDER":
      return "/expert/sessions";
    case "PAYMENT_FAILED":
      return "/dashboard";
    case "PAYMENT_REFUND": {
      const bookingId = data.bookingId as string | undefined;
      return bookingId ? `/dashboard/my-bookings` : "/dashboard/my-bookings";
    }
    case "REVIEW_RECEIVED":
      return "/dashboard";
    default:
      return "/notifications";
  }
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ className }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && notifications.length === 0) {
      fetchNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      setUnreadCount(response.count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationApi.getNotifications(1, 10);
      setNotifications(response.data);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleDelete = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      const wasUnread = notifications.find((n) => n._id === notificationId)?.isRead === false;
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // Mark as read (fire-and-forget)
      if (!notification.isRead) {
        notificationApi.markAsRead(notification._id).catch(() => {});
        setNotifications((prev) =>
          prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      setIsOpen(false);

      const url = getNotificationLink(notification);
      // External URL (different app/port) — full navigation
      if (url.startsWith("http")) {
        window.location.href = url;
      } else {
        router.push(url);
      }
    },
    [router]
  );

  const getNotificationIcon = (category: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      SOCIAL: Users,
      BOOKING: Calendar,
      PAYMENT: CreditCard,
      REVIEW: Star,
      ADMIN: Settings,
      COMMUNITY: MessageCircle,
    };
    return iconMap[category] || Bell;
  };

  const getNotificationTone = (category: string) => {
    const toneMap: Record<
      string,
      { iconWrap: string; iconColor: string; dot: string; chip: string }
    > = {
      SOCIAL: {
        iconWrap: "bg-sky-100",
        iconColor: "text-sky-700",
        dot: "bg-sky-500",
        chip: "bg-sky-50 text-sky-700 border-sky-200",
      },
      BOOKING: {
        iconWrap: "bg-indigo-100",
        iconColor: "text-indigo-700",
        dot: "bg-indigo-500",
        chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
      },
      PAYMENT: {
        iconWrap: "bg-emerald-100",
        iconColor: "text-emerald-700",
        dot: "bg-turf-green",
        chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      REVIEW: {
        iconWrap: "bg-amber-100",
        iconColor: "text-amber-700",
        dot: "bg-amber-500",
        chip: "bg-amber-50 text-amber-700 border-amber-200",
      },
      ADMIN: {
        iconWrap: "bg-slate-200",
        iconColor: "text-slate-700",
        dot: "bg-slate-500",
        chip: "bg-slate-100 text-slate-700 border-slate-200",
      },
      COMMUNITY: {
        iconWrap: "bg-orange-100",
        iconColor: "text-orange-700",
        dot: "bg-power-orange",
        chip: "bg-orange-50 text-orange-700 border-orange-200",
      },
    };

    return (
      toneMap[category] || {
        iconWrap: "bg-slate-100",
        iconColor: "text-slate-700",
        dot: "bg-slate-500",
        chip: "bg-slate-100 text-slate-700 border-slate-200",
      }
    );
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Bell Icon with Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus:ring-power-orange relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="max-h-150 absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(120deg,#f9fbff_0%,#eef5ff_100%)] px-4 py-3">
              <h3 className="text-lg font-semibold text-slate-900">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="border-power-orange/30 bg-power-orange/10 text-power-orange hover:bg-power-orange/15 rounded-md border px-2 py-1 text-xs font-semibold transition focus:outline-none"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="max-h-120 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="border-power-orange h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
                  <Bell className="mb-3 h-12 w-12 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const tone = getNotificationTone(notification.category);
                  return (
                    <button
                      key={notification._id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "focus-visible:ring-power-orange w-full border-b border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset",
                        !notification.isRead && "bg-[#eef6ff]/75"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            "mt-1 shrink-0 rounded-full p-2",
                            tone.iconWrap,
                            tone.iconColor
                          )}
                        >
                          {React.createElement(getNotificationIcon(notification.category), {
                            className: "h-4 w-4",
                          })}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              className={cn(
                                "text-sm font-medium text-slate-900",
                                !notification.isRead && "font-semibold text-slate-950"
                              )}
                            >
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <span
                                className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", tone.dot)}
                              />
                            )}
                          </div>
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                            {notification.message}
                          </p>
                          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                tone.chip
                              )}
                            >
                              {notification.category}
                            </span>
                            <span>{formatDistanceToNow(new Date(notification.createdAt))}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex shrink-0 items-center gap-1">
                          {!notification.isRead && (
                            <span
                              role="button"
                              onClick={(e) => handleMarkAsRead(notification._id, e)}
                              className="rounded p-1 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                              title="Mark as read"
                            >
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                          <span
                            role="button"
                            onClick={(e) => handleDelete(notification._id, e)}
                            className="rounded p-1 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-slate-200 bg-[linear-gradient(120deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-3">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-power-orange block text-center text-sm font-semibold hover:underline"
                >
                  View All Notifications
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
