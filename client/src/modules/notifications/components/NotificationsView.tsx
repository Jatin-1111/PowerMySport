"use client";

import { Container } from "@/components/layout/Container";
import {
  notificationApi,
  type Notification,
  type NotificationChannelPreferences,
  type NotificationPreferences,
} from "@/lib/api/notification";
import {
  NotificationRow,
  NotificationRowSkeleton,
} from "@/modules/notifications/components/NotificationRow";
import { NotificationPreferencesPanel } from "@/modules/notifications/components/NotificationPreferencesPanel";
import { filterOptions, type FilterType } from "@/modules/notifications/config/notificationFilters";
import { getPaginationRange } from "@/modules/notifications/utils/pagination";
import { cn } from "@/utils/cn";
import { CheckCheck, ChevronLeft, ChevronRight, Loader2, Settings } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const TEXT_BUTTON =
  "text-ink hover:bg-paper-deep focus-visible:ring-ink inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50";

const PAGE_BUTTON =
  "focus-visible:ring-ink flex h-10 min-w-10 items-center justify-center rounded-md border px-2 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40";

// --- Main view ---

/**
 * The notifications list. It is rendered inside each role's dashboard
 * (`embedded`, so the shell supplies the page frame) and, for roles without a
 * console, on the standalone `/notifications` route.
 */
export function NotificationsView({ embedded = false }: { embedded?: boolean }) {
  return (
    <Suspense
      fallback={
        <div className="bg-paper min-h-screen py-10">
          <Container>
            <div className="text-ink-muted flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications
            </div>
          </Container>
        </div>
      }
    >
      <NotificationsPageContent embedded={embedded} />
    </Suspense>
  );
}

function NotificationsPageContent({ embedded }: { embedded: boolean }) {
  const searchParams = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    const intent = (searchParams.get("intent") || "").toLowerCase() as FilterType;
    const valid: FilterType[] = [
      "community",
      "booking",
      "social",
      "payment",
      "review",
      "admin",
      "plan",
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
      setLoadFailed(false);
      const filters: Record<string, boolean | string> = {};
      if (filter === "unread") filters.isRead = false;
      else if (filter !== "all") filters.category = filter.toUpperCase();
      const response = await notificationApi.getNotifications(page, 20, filters);
      setNotifications(response.data);
      setTotalPages(response.pagination.pages);
    } catch (e) {
      console.error(e);
      setLoadFailed(true);
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
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
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
      const wasUnread = notifications.find((n) => n._id === id)?.isRead === false;
      await notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const togglePreference = async (
    channel: "email" | "push" | "inApp",
    key: keyof NotificationChannelPreferences
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

  const content = (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-editorial text-ink text-4xl font-light leading-tight tracking-tight sm:text-5xl">
            Notifications
          </h1>
          <p className="text-ink-muted mt-2" aria-live="polite">
            {unreadCount > 0
              ? `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`
              : "You're all caught up"}
          </p>
        </div>

        <div className="-ml-3 flex items-center gap-1 sm:ml-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAllRead}
              className={TEXT_BUTTON}
            >
              {isMarkingAllRead ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPreferences((prev) => !prev)}
            aria-expanded={showPreferences}
            className={cn(TEXT_BUTTON, showPreferences && "bg-paper-deep")}
          >
            <Settings className="h-4 w-4" />
            Preferences
          </button>
        </div>
      </header>

      <div className="mt-8">
        {showPreferences && preferences && (
          <NotificationPreferencesPanel
            preferences={preferences}
            isSaving={isSavingPreferences}
            onClose={() => setShowPreferences(false)}
            onToggle={togglePreference}
          />
        )}
      </div>

      {/* Filters: underlined text tabs rather than a row of pills */}
      <nav aria-label="Filter notifications" className="border-hairline border-b">
        <div className="hide-scrollbar -mb-px flex gap-6 overflow-x-auto">
          {filterOptions.map((option) => {
            const isActive = filter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setFilter(option.value);
                  setPage(1);
                }}
                className={cn(
                  "focus-visible:ring-ink shrink-0 whitespace-nowrap border-b-2 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                  isActive
                    ? "border-ink text-ink font-semibold"
                    : "text-ink-muted hover:text-ink border-transparent"
                )}
              >
                {option.label}
                {option.value === "unread" && unreadCount > 0 && (
                  <span className="ml-1.5 tabular-nums">{unreadCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {loading ? (
        <div className="divide-hairline divide-y" aria-busy="true" aria-label="Loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <NotificationRowSkeleton key={i} />
          ))}
        </div>
      ) : loadFailed ? (
        <div className="py-20 text-center">
          <p className="font-editorial text-ink text-2xl font-light">
            We couldn&apos;t load your notifications
          </p>
          <p className="text-ink-body mt-2">Check your connection and try again.</p>
          <button
            type="button"
            onClick={fetchNotifications}
            className="bg-ink hover:bg-ink-hover focus-visible:ring-ink mt-6 rounded-md px-5 py-2.5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-editorial text-ink text-2xl font-light">
            {filter === "unread" ? "Nothing left to read" : "No notifications here yet"}
          </p>
          <p className="text-ink-body mx-auto mt-2 max-w-sm text-pretty">
            {filter === "unread"
              ? "You've read everything. New updates will show up here."
              : "Booking updates, friend requests and reminders will show up here."}
          </p>
        </div>
      ) : (
        <ul className="divide-hairline divide-y">
          {notifications.map((notification) => (
            <NotificationRow
              key={notification._id}
              notification={notification}
              onMarkRead={handleMarkAsRead}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="border-hairline mt-4 flex items-center justify-center gap-1.5 border-t pt-8"
        >
          <button
            type="button"
            aria-label="Previous page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(PAGE_BUTTON, "border-hairline text-ink hover:bg-paper-deep bg-white")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {getPaginationRange(page, totalPages).map((pageNum, idx) =>
            pageNum === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="text-ink-muted flex h-10 w-8 items-center justify-center text-sm"
              >
                …
              </span>
            ) : (
              <button
                key={pageNum}
                type="button"
                aria-label={`Page ${pageNum}`}
                aria-current={page === pageNum ? "page" : undefined}
                onClick={() => setPage(pageNum as number)}
                className={cn(
                  PAGE_BUTTON,
                  page === pageNum
                    ? "border-ink bg-ink text-white"
                    : "border-hairline text-ink hover:bg-paper-deep bg-white"
                )}
              >
                {pageNum}
              </button>
            )
          )}

          <button
            type="button"
            aria-label="Next page"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={cn(PAGE_BUTTON, "border-hairline text-ink hover:bg-paper-deep bg-white")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );

  if (embedded) return content;
  return (
    <div className="bg-paper flex-1 pb-24 pt-8 sm:pt-12">
      <Container>{content}</Container>
    </div>
  );
}
