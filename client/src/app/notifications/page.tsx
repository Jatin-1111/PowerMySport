"use client";

import React, { Suspense, useEffect, useState } from "react";
import {
  notificationApi,
  type Notification,
  type NotificationChannelPreferences,
  type NotificationPreferences,
} from "@/lib/api/notification";
import {
  Bell,
  Calendar,
  Check,
  CheckCheck,
  CreditCard,
  Filter,
  ExternalLink,
  MessageCircle,
  Settings,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { formatDistanceToNow } from "@/utils/date";
import { Container } from "@/components/layout/Container";
import { useRouter, useSearchParams } from "next/navigation";

type FilterType =
  | "all"
  | "unread"
  | "social"
  | "booking"
  | "payment"
  | "review"
  | "admin"
  | "community";

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_52%,#fff7ea_100%)] py-8">
          <Container>
            <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
              <p className="text-sm text-muted-foreground">
                Loading notifications...
              </p>
            </div>
          </Container>
        </div>
      }
    >
      <NotificationsPageContent />
    </Suspense>
  );
}

function NotificationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);

  useEffect(() => {
    const intent = (searchParams.get("intent") || "").toLowerCase();
    if (intent === "community") setFilter("community");
    if (intent === "booking") setFilter("booking");
    if (intent === "social") setFilter("social");
    if (intent === "payment") setFilter("payment");
    if (intent === "review") setFilter("review");
    if (intent === "admin") setFilter("admin");
  }, [searchParams]);

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  useEffect(() => {
    fetchUnreadCount();
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await notificationApi.getPreferences();
      setPreferences({
        email: response.data?.email || {},
        push: response.data?.push || {},
        inApp: response.data?.inApp || {},
      });
    } catch (error) {
      console.error("Failed to fetch notification preferences:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const filters: Record<string, boolean | string> = {};

      if (filter === "unread") {
        filters.isRead = false;
      } else if (filter !== "all") {
        filters.category = filter.toUpperCase();
      }

      const response = await notificationApi.getNotifications(
        page,
        20,
        filters,
      );
      setNotifications(response.data);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      setUnreadCount(response.count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
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

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const handleDelete = async (notificationId: string) => {
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

  const togglePreference = async (
    channel: "email" | "push" | "inApp",
    key: keyof NotificationChannelPreferences,
  ) => {
    if (!preferences) return;

    const channelPreferences = preferences[channel] || {};

    const next = {
      ...preferences,
      [channel]: {
        ...channelPreferences,
        [key]: !Boolean(channelPreferences[key]),
      },
    };

    setPreferences(next);
    try {
      setIsSavingPreferences(true);
      await notificationApi.updatePreferences(next);
    } catch (error) {
      console.error("Failed to save notification preferences:", error);
      setPreferences(preferences);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const getNotificationAction = (notification: Notification) => {
    const data = (notification.data || {}) as Record<string, unknown>;
    if (notification.category === "BOOKING") {
      return { label: "Open bookings", href: "/dashboard/my-bookings" };
    }
    if (notification.category === "SOCIAL") {
      return { label: "Open friends", href: "/dashboard/friends" };
    }
    if (notification.category === "PAYMENT") {
      return { label: "Open payments", href: "/dashboard/my-bookings" };
    }
    if (notification.category === "REVIEW") {
      return { label: "Open reviews", href: "/dashboard/my-bookings" };
    }
    if (notification.category === "COMMUNITY") {
      const postId = typeof data.postId === "string" ? data.postId : "";
      return {
        label: "Open community",
        href: postId
          ? `https://community.powermysport.com/q/${postId}`
          : "https://community.powermysport.com/q",
        external: true,
      };
    }

    return { label: "Open dashboard", href: "/dashboard" };
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
      { iconWrap: string; iconColor: string; chip: string; dot: string }
    > = {
      SOCIAL: {
        iconWrap: "bg-sky-100",
        iconColor: "text-sky-700",
        chip: "bg-sky-50 text-sky-700 border-sky-200",
        dot: "bg-sky-500",
      },
      BOOKING: {
        iconWrap: "bg-indigo-100",
        iconColor: "text-indigo-700",
        chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
        dot: "bg-indigo-500",
      },
      PAYMENT: {
        iconWrap: "bg-emerald-100",
        iconColor: "text-emerald-700",
        chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      },
      REVIEW: {
        iconWrap: "bg-amber-100",
        iconColor: "text-amber-700",
        chip: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      },
      ADMIN: {
        iconWrap: "bg-slate-200",
        iconColor: "text-slate-700",
        chip: "bg-slate-100 text-slate-700 border-slate-200",
        dot: "bg-slate-500",
      },
      COMMUNITY: {
        iconWrap: "bg-orange-100",
        iconColor: "text-orange-700",
        chip: "bg-orange-50 text-orange-700 border-orange-200",
        dot: "bg-orange-500",
      },
    };

    return (
      toneMap[category] || {
        iconWrap: "bg-slate-100",
        iconColor: "text-slate-700",
        chip: "bg-slate-100 text-slate-700 border-slate-200",
        dot: "bg-slate-500",
      }
    );
  };

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread" },
    { value: "social", label: "Social" },
    { value: "booking", label: "Bookings" },
    { value: "payment", label: "Payments" },
    { value: "review", label: "Reviews" },
    { value: "community", label: "Community" },
    { value: "admin", label: "Admin" },
  ];

  const preferenceKeys: Array<{
    key: keyof NotificationChannelPreferences;
    label: string;
  }> = [
    { key: "friendRequests", label: "Friend Requests" },
    { key: "bookingInvitations", label: "Booking Invitations" },
    { key: "bookingConfirmations", label: "Booking Confirmations" },
    { key: "bookingReminders", label: "Booking Reminders" },
    { key: "reviews", label: "Reviews" },
    { key: "payments", label: "Payments" },
    { key: "admin", label: "Admin Updates" },
    { key: "marketing", label: "Marketing" },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_52%,#fff7ea_100%)] py-8">
      <Container>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  You have {unreadCount} unread notification
                  {unreadCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </button>
            )}
            <button
              onClick={() => setShowPreferences((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Settings className="w-4 h-4" />
              Preferences
            </button>
          </div>

          {showPreferences && preferences && (
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
              <p className="text-sm font-semibold text-slate-900">
                Notification preferences{" "}
                {isSavingPreferences ? "(saving...)" : ""}
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                {(["inApp", "push", "email"] as const).map((channel) => (
                  <div
                    key={channel}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {channel}
                    </p>
                    <div className="mt-2 space-y-2">
                      {preferenceKeys.map((pref) => {
                        const checked = Boolean(
                          preferences[channel]?.[pref.key],
                        );
                        return (
                          <label
                            key={`${channel}-${pref.key}`}
                            className="flex items-center justify-between gap-2 text-xs text-slate-700"
                          >
                            <span>{pref.label}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                togglePreference(channel, pref.key)
                              }
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setFilter(option.value);
                  setPage(1);
                }}
                className={cn(
                  "px-4 py-2 rounded-xl border text-sm font-medium transition-colors",
                  filter === option.value
                    ? "border-power-orange/40 bg-power-orange/10 text-power-orange"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {option.label}
                {option.value === "unread" && unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-sm backdrop-blur-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-power-orange border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No notifications found</p>
              <p className="text-sm mt-1">
                {filter === "unread"
                  ? "You're all caught up!"
                  : "Check back later for updates"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) =>
                (() => {
                  const tone = getNotificationTone(notification.category);
                  return (
                    <div
                      key={notification._id}
                      className={cn(
                        "p-4 transition-colors hover:bg-slate-50/70",
                        !notification.isRead && "bg-[#eef6ff]/65",
                      )}
                    >
                      <div className="flex items-start gap-4">
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
                              className: "h-5 w-5",
                            },
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3
                              className={cn(
                                "text-base font-medium text-slate-900",
                                !notification.isRead &&
                                  "font-semibold text-slate-950",
                              )}
                            >
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <span
                                className={cn(
                                  "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                                  tone.dot,
                                )}
                              />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-xs font-semibold",
                                  tone.chip,
                                )}
                              >
                                {notification.category}
                              </span>
                            </span>
                            <span>
                              {formatDistanceToNow(
                                new Date(notification.createdAt),
                              )}
                            </span>
                          </div>
                          {(() => {
                            const action = getNotificationAction(notification);
                            return action.external ? (
                              <a
                                href={action.href}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-power-orange hover:underline"
                              >
                                {action.label}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <button
                                onClick={() => router.push(action.href)}
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-power-orange hover:underline"
                              >
                                {action.label}
                              </button>
                            );
                          })()}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification._id)}
                              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                              title="Mark as read"
                            >
                              <Check className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification._id)}
                            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })(),
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "h-10 w-10 rounded-lg border text-sm font-medium transition-colors",
                      page === pageNum
                        ? "border-power-orange/40 bg-power-orange/10 text-power-orange"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="px-2">...</span>}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </Container>
    </div>
  );
}
