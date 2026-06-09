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
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Inbox,
  Zap,
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

// --- Constants & Helpers ---

const filterOptions: {
  value: FilterType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "all", label: "All", icon: Bell },
  { value: "unread", label: "Unread", icon: Zap },
  { value: "social", label: "Social", icon: Users },
  { value: "booking", label: "Bookings", icon: Calendar },
  { value: "payment", label: "Payments", icon: CreditCard },
  { value: "review", label: "Reviews", icon: Star },
  { value: "community", label: "Community", icon: MessageCircle },
  { value: "admin", label: "Admin", icon: Settings },
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

const getNotificationAction = (notification: Notification) => {
  const data = (notification.data || {}) as Record<string, unknown>;
  if (notification.category === "BOOKING")
    return { label: "View Booking", href: "/dashboard/my-bookings" };
  if (notification.category === "SOCIAL")
    return { label: "View Friends", href: "/dashboard/friends" };
  if (notification.category === "PAYMENT") {
    if (typeof data.orderId === "string" && data.orderId)
      return { label: "View Order", href: `/dashboard/orders/${data.orderId}` };
    if (typeof data.bookingId === "string" && data.bookingId)
      return {
        label: "View Booking",
        href: `/dashboard/my-bookings?id=${data.bookingId}`,
      };
    return { label: "View Payments", href: "/dashboard/my-bookings" };
  }
  if (notification.category === "REVIEW")
    return { label: "View Review", href: "/dashboard/my-bookings" };
  if (notification.category === "COMMUNITY") {
    const postId = typeof data.postId === "string" ? data.postId : "";
    return {
      label: "Open Community",
      href: postId
        ? `https://community.powermysport.com/q/${postId}`
        : "https://community.powermysport.com/q",
      external: true,
    };
  }
  return { label: "Open Dashboard", href: "/dashboard" };
};

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

const categoryConfig: Record<
  string,
  {
    iconWrap: string;
    iconColor: string;
    badge: string;
    dot: string;
    accent: string;
    unreadBg: string;
  }
> = {
  SOCIAL: {
    iconWrap: "bg-sky-100",
    iconColor: "text-sky-600",
    badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    dot: "bg-sky-500",
    accent: "border-l-sky-400",
    unreadBg: "bg-sky-50/40",
  },
  BOOKING: {
    iconWrap: "bg-violet-100",
    iconColor: "text-violet-600",
    badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    dot: "bg-violet-500",
    accent: "border-l-violet-400",
    unreadBg: "bg-violet-50/30",
  },
  PAYMENT: {
    iconWrap: "bg-emerald-100",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
    accent: "border-l-emerald-400",
    unreadBg: "bg-emerald-50/30",
  },
  REVIEW: {
    iconWrap: "bg-amber-100",
    iconColor: "text-amber-600",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-400",
    accent: "border-l-amber-400",
    unreadBg: "bg-amber-50/30",
  },
  ADMIN: {
    iconWrap: "bg-slate-100",
    iconColor: "text-slate-600",
    badge: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    accent: "border-l-slate-400",
    unreadBg: "bg-slate-50/40",
  },
  COMMUNITY: {
    iconWrap: "bg-orange-100",
    iconColor: "text-orange-600",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    dot: "bg-orange-500",
    accent: "border-l-orange-400",
    unreadBg: "bg-orange-50/30",
  },
};

const getConfig = (category: string) =>
  categoryConfig[category] ?? {
    iconWrap: "bg-slate-100",
    iconColor: "text-slate-600",
    badge: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    accent: "border-l-slate-300",
    unreadBg: "bg-slate-50/30",
  };

const getPaginationRange = (currentPage: number, totalPages: number) => {
  const delta = 1;
  const range: (number | "...")[] = [];
  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }
  if (currentPage - delta > 2) range.unshift("...");
  if (currentPage + delta < totalPages - 1) range.push("...");
  range.unshift(1);
  if (totalPages > 1 && !range.includes(totalPages)) range.push(totalPages);
  return range;
};

// --- Toggle Switch ---
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        checked ? "bg-orange-500" : "bg-slate-200",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// --- Skeleton ---
function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 sm:px-5 sm:py-5">
      <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-4 bg-slate-100 rounded-lg w-2/3 animate-pulse" />
        <div className="h-3 bg-slate-100 rounded-lg w-full animate-pulse" />
        <div className="h-3 bg-slate-100 rounded-lg w-1/3 animate-pulse" />
      </div>
      <div className="h-8 w-8 bg-slate-100 rounded-lg animate-pulse shrink-0" />
    </div>
  );
}

// --- Notification Card ---
function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const config = getConfig(notification.category);
  const Icon = getNotificationIcon(notification.category);
  const action = getNotificationAction(notification);
  const isUnread = !notification.isRead;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 sm:gap-4 px-4 py-4 sm:px-5 sm:py-4 transition-all duration-150",
        "border-l-2",
        isUnread
          ? [config.accent, config.unreadBg]
          : "border-l-transparent hover:bg-slate-50/60",
      )}
    >
      {/* Icon */}
      <div className={cn("mt-0.5 shrink-0 rounded-xl p-2.5", config.iconWrap)}>
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", config.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug text-slate-800 truncate pr-2",
              isUnread && "font-semibold text-slate-900",
            )}
          >
            {notification.title}
          </p>
          {isUnread && (
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", config.dot)}
            />
          )}
        </div>

        <p className="mt-0.5 text-sm text-slate-500 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
              config.badge,
            )}
          >
            {notification.category.toLowerCase()}
          </span>
          <span className="text-xs text-slate-400">
            {formatDistanceToNow(new Date(notification.createdAt))}
          </span>
          {action.external ? (
            <a
              href={action.href}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-orange-500 hover:text-orange-600 hover:underline transition-colors"
            >
              {action.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <button
              onClick={() => router.push(action.href)}
              className="ml-auto text-xs font-semibold text-orange-500 hover:text-orange-600 hover:underline transition-colors"
            >
              {action.label} →
            </button>
          )}
        </div>
      </div>

      {/* Action buttons — revealed on hover on desktop, always visible on mobile */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 transition-all",
          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
        )}
      >
        {isUnread && (
          <button
            onClick={() => onMarkRead(notification._id)}
            title="Mark as read"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onDelete(notification._id)}
          title="Delete"
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// --- Preferences Panel ---
function PreferencesPanel({
  preferences,
  isSaving,
  onClose,
  onToggle,
}: {
  preferences: NotificationPreferences;
  isSaving: boolean;
  onClose: () => void;
  onToggle: (
    channel: "email" | "push" | "inApp",
    key: keyof NotificationChannelPreferences,
  ) => void;
}) {
  const channels = ["inApp", "push", "email"] as const;
  const channelLabels = { inApp: "In-App", push: "Push", email: "Email" };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden mb-5">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3.5 sm:px-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">
            Notification Preferences
          </span>
          {isSaving && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving…
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-full">
                Notification Type
              </th>
              {channels.map((ch) => (
                <th
                  key={ch}
                  className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {channelLabels[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {preferenceKeys.map((pref, idx) => (
              <tr
                key={pref.key}
                className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}
              >
                <td className="px-4 sm:px-5 py-3 text-sm text-slate-700 font-medium">
                  {pref.label}
                </td>
                {channels.map((ch) => (
                  <td key={ch} className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Toggle
                        checked={Boolean(preferences[ch]?.[pref.key])}
                        onChange={() => onToggle(ch, pref.key)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Main Page ---
export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-8">
          <Container>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications…
              </div>
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
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    const intent = (
      searchParams.get("intent") || ""
    ).toLowerCase() as FilterType;
    const valid: FilterType[] = [
      "community",
      "booking",
      "social",
      "payment",
      "review",
      "admin",
    ];
    if (valid.includes(intent)) setFilter(intent);
  }, [searchParams]);

  useEffect(() => {
    fetchNotifications();
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
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const filters: Record<string, boolean | string> = {};
      if (filter === "unread") filters.isRead = false;
      else if (filter !== "all") filters.category = filter.toUpperCase();
      const response = await notificationApi.getNotifications(
        page,
        20,
        filters,
      );
      setNotifications(response.data);
      setTotalPages(response.pagination.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationApi.getUnreadCount();
      setUnreadCount(response.count);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAllRead) return;
    try {
      setIsMarkingAllRead(true);
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const wasUnread =
        notifications.find((n) => n._id === id)?.isRead === false;
      await notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const togglePreference = async (
    channel: "email" | "push" | "inApp",
    key: keyof NotificationChannelPreferences,
  ) => {
    if (!preferences) return;
    const next = {
      ...preferences,
      [channel]: {
        ...preferences[channel],
        [key]: !Boolean(preferences[channel]?.[key]),
      },
    };
    setPreferences(next);
    try {
      setIsSavingPreferences(true);
      await notificationApi.updatePreferences(next);
    } catch (e) {
      console.error(e);
      setPreferences(preferences);
    } finally {
      setIsSavingPreferences(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] via-[#f6f8ff] to-[#fff8f0] py-6 sm:py-10">
      <Container>
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Notifications
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                  : "You're all caught up"}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAllRead}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMarkingAllRead ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4" />
                  )}
                  <span className="hidden xs:inline">Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setShowPreferences((prev) => !prev)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium shadow-sm transition",
                  showPreferences
                    ? "border-orange-200 bg-orange-50 text-orange-600"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden xs:inline">Preferences</span>
              </button>
            </div>
          </div>

          {/* Preferences Panel */}
          {showPreferences && preferences && (
            <PreferencesPanel
              preferences={preferences}
              isSaving={isSavingPreferences}
              onClose={() => setShowPreferences(false)}
              onToggle={togglePreference}
            />
          )}

          {/* Filter Tabs */}
          <div className="relative">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
              {filterOptions.map((option) => {
                const Icon = option.icon;
                const isActive = filter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setFilter(option.value);
                      setPage(1);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-all duration-150",
                      isActive
                        ? "border-orange-300 bg-orange-500 text-white shadow-sm shadow-orange-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                    {option.value === "unread" && unreadCount > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0 text-[11px] font-bold leading-5 min-w-[20px] text-center",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-red-500 text-white",
                        )}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Notifications Container */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-base font-semibold text-slate-700">
                No notifications
              </p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                {filter === "unread"
                  ? "You're all caught up! Nothing left to read."
                  : "No notifications here yet. Check back later."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification._id}
                  notification={notification}
                  onMarkRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1">
              {getPaginationRange(page, totalPages).map((pageNum, idx) =>
                pageNum === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-9 w-9 items-center justify-center text-slate-400 text-sm"
                  >
                    ···
                  </span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum as number)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-medium transition-all",
                      page === pageNum
                        ? "border-orange-300 bg-orange-500 text-white shadow-sm shadow-orange-200"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {pageNum}
                  </button>
                ),
              )}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </Container>
    </div>
  );
}
