"use client";

import React, { useEffect, useState, useRef } from "react";
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
import { cn } from "@/utils/cn";
import { notificationApi, type Notification } from "@/lib/api/notification";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { formatDistanceToNow } from "@/utils/date";

interface NotificationDropdownProps {
  className?: string;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Every 30 seconds
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

  const handleMarkAsRead = async (
    notificationId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    try {
      await notificationApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId ? { ...n, isRead: true } : n,
        ),
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
      const wasUnread =
        notifications.find((n) => n._id === notificationId)?.isRead === false;
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

  const getNotificationIcon = (category: string) => {
    const iconMap: Record<
      string,
      React.ComponentType<{ className?: string }>
    > = {
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
        dot: "bg-emerald-500",
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
        dot: "bg-orange-500",
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
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-power-orange"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
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
            className="absolute right-0 z-50 mt-2 max-h-150 w-96 overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-xl backdrop-blur-sm"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(120deg,#f9fbff_0%,#eef5ff_100%)] px-4 py-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="rounded-md border border-power-orange/30 bg-power-orange/10 px-2 py-1 text-xs font-semibold text-power-orange transition hover:bg-power-orange/15 focus:outline-none"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto max-h-120">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-power-orange border-t-transparent rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const tone = getNotificationTone(notification.category);
                  return (
                    <div
                      key={notification._id}
                      className={cn(
                        "cursor-pointer border-b border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50",
                        !notification.isRead && "bg-[#eef6ff]/75",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                          className={cn(
                            "mt-1 shrink-0 rounded-full p-2",
                            tone.iconWrap,
                            tone.iconColor,
                          )}
                        >
                          {React.createElement(
                            getNotificationIcon(notification.category),
                            {
                              className: "h-4 w-4",
                            },
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              className={cn(
                                "text-sm font-medium text-slate-900",
                                !notification.isRead &&
                                  "font-semibold text-slate-950",
                              )}
                            >
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <span
                                className={cn(
                                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                                  tone.dot,
                                )}
                              />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                tone.chip,
                              )}
                            >
                              {notification.category}
                            </span>
                            <span>
                              {formatDistanceToNow(
                                new Date(notification.createdAt),
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={(e) =>
                                handleMarkAsRead(notification._id, e)
                              }
                              className="rounded p-1 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDelete(notification._id, e)}
                            className="rounded p-1 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
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
                  className="block text-center text-sm font-semibold text-power-orange hover:underline"
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
