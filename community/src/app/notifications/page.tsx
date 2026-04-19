"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { communityService } from "@/modules/community/services/community";
import { CommunityActivityItem } from "@/modules/community/types";
import { toast } from "@/lib/toast";

type NotificationFilter = "ALL" | "UNREAD";

const PAGE_SIZE = 20;

const eventTypeOrder: Record<string, number> = {
  "Q&A": 1,
  Message: 2,
  Request: 3,
  Group: 4,
  Community: 5,
};

const toRelativeTime = (value: string): string => {
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return "";
  const diffMin = Math.max(1, Math.floor((Date.now() - at) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
};

const toDateKey = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "unknown";
  }

  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
};

const toDateHeading = (dateKey: string): string => {
  if (dateKey === "unknown") {
    return "Unknown date";
  }

  const [y, m, d] = dateKey.split("-").map((part) => Number(part));
  const at = new Date(y, m - 1, d);
  if (Number.isNaN(at.getTime())) {
    return "Unknown date";
  }

  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startAt = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  return at.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getEventLabel = (item: CommunityActivityItem): string => {
  const event = item.data?.event || "";

  if (event === "COMMUNITY_ANSWER_CREATED") return "Q&A";
  if (event === "COMMUNITY_UPVOTE_RECEIVED") return "Q&A";
  if (event === "COMMUNITY_MESSAGE_RECEIVED") return "Message";
  if (event === "COMMUNITY_CONVERSATION_REQUESTED") return "Request";
  if (event === "COMMUNITY_CONVERSATION_ACCEPTED") return "Request";
  if (event === "COMMUNITY_CONVERSATION_REJECTED") return "Request";
  if (event === "COMMUNITY_GROUP_MEMBER_ADDED") return "Group";
  if (event === "COMMUNITY_GROUP_JOINED") return "Group";
  if (event === "COMMUNITY_GROUP_LEFT") return "Group";

  return "Community";
};

const buildActionHref = (item: CommunityActivityItem): string | null => {
  if (item.data?.postId) {
    return `/q/${item.data.postId}`;
  }

  if (item.data?.conversationId) {
    return `/?sidebar=inbox&conversation=${encodeURIComponent(item.data.conversationId)}`;
  }

  if (item.data?.groupId) {
    return `/?group=${encodeURIComponent(item.data.groupId)}`;
  }

  return null;
};

export default function CommunityNotificationsPage() {
  const [items, setItems] = useState<CommunityActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => items.reduce((count, item) => (item.isRead ? count : count + 1), 0),
    [items],
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  );

  const groupedItems = useMemo(() => {
    const dateBuckets = new Map<string, Map<string, CommunityActivityItem[]>>();

    for (const item of sortedItems) {
      const dateKey = toDateKey(item.createdAt);
      const eventLabel = getEventLabel(item);

      if (!dateBuckets.has(dateKey)) {
        dateBuckets.set(dateKey, new Map<string, CommunityActivityItem[]>());
      }

      const typeBuckets = dateBuckets.get(dateKey)!;
      if (!typeBuckets.has(eventLabel)) {
        typeBuckets.set(eventLabel, []);
      }

      typeBuckets.get(eventLabel)!.push(item);
    }

    return [...dateBuckets.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, typeBuckets]) => {
        const typeGroups = [...typeBuckets.entries()]
          .sort(([a], [b]) => {
            const scoreA = eventTypeOrder[a] ?? 999;
            const scoreB = eventTypeOrder[b] ?? 999;
            if (scoreA !== scoreB) {
              return scoreA - scoreB;
            }
            return a.localeCompare(b);
          })
          .map(([label, notifications]) => ({
            label,
            items: notifications,
          }));

        return {
          dateKey,
          heading: toDateHeading(dateKey),
          typeGroups,
        };
      });
  }, [sortedItems]);

  const loadNotifications = useCallback(
    async (targetPage = 1) => {
      try {
        setIsLoading(true);
        const response = await communityService.listCommunityNotifications(
          targetPage,
          PAGE_SIZE,
          filter === "UNREAD" ? false : undefined,
        );

        setItems(response.items || []);
        setPage(targetPage);
        setPages(Math.max(1, response.pagination.pages || 1));
      } catch {
        setItems([]);
        setPage(targetPage);
        setPages(1);
        toast.error("Failed to load notifications");
      } finally {
        setIsLoading(false);
      }
    },
    [filter],
  );

  const handleMarkRead = useCallback(async (item: CommunityActivityItem) => {
    if (item.isRead) {
      return;
    }

    try {
      await communityService.markCommunityNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, isRead: true } : entry,
        ),
      );
    } catch {
      toast.error("Failed to mark notification as read");
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!unreadCount || isMarkingAll) {
      return;
    }

    try {
      setIsMarkingAll(true);
      const count = await communityService.markAllCommunityNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      if (count > 0) {
        toast.success("All notifications marked as read");
      }
    } catch {
      toast.error("Failed to mark notifications as read");
    } finally {
      setIsMarkingAll(false);
    }
  }, [isMarkingAll, unreadCount]);

  useEffect(() => {
    void loadNotifications(1);
  }, [loadNotifications]);

  useEffect(() => {
    const socket = getCommunitySocket();

    const refresh = () => {
      void loadNotifications(1);
    };

    socket.on("notification:new", refresh);
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", refresh);
    };
  }, [loadNotifications]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="rounded-2xl border border-white/90 bg-white/90 p-4 shadow-sm backdrop-blur-md sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Community
            </p>
            <h1 className="mt-1 font-title text-2xl font-semibold text-slate-900">
              Notifications
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadNotifications(page)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0 || isMarkingAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck size={14} />
              {isMarkingAll ? "Marking..." : "Mark all read"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setFilter("ALL")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              filter === "ALL"
                ? "border-power-orange/50 bg-power-orange/10 text-power-orange"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("UNREAD")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
              filter === "UNREAD"
                ? "border-power-orange/50 bg-power-orange/10 text-power-orange"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Unread
          </button>
          {unreadCount > 0 ? (
            <span className="ml-1 rounded-full bg-power-orange/10 px-2.5 py-1 text-[11px] font-semibold text-power-orange">
              {unreadCount} unread
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/90 bg-white/90 p-4 shadow-sm backdrop-blur-md sm:p-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle size={16} className="animate-spin" />
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Bell size={22} className="mx-auto text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              No notifications yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Actions like answers, upvotes, requests, and messages will show
              here.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedItems.map((dateGroup) => (
              <div key={dateGroup.dateKey} className="space-y-3">
                <div className="sticky top-16 z-10 -mx-1 rounded-lg bg-white/90 px-1 py-1 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {dateGroup.heading}
                  </p>
                </div>

                {dateGroup.typeGroups.map((typeGroup) => (
                  <div
                    key={`${dateGroup.dateKey}-${typeGroup.label}`}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {typeGroup.label}
                      </p>
                      <span className="text-[11px] text-slate-400">
                        {typeGroup.items.length}
                      </span>
                    </div>

                    {typeGroup.items.map((item) => {
                      const actionHref = buildActionHref(item);

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border p-3 transition ${
                            item.isRead
                              ? "border-slate-200 bg-white"
                              : "border-power-orange/30 bg-power-orange/5"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                  {getEventLabel(item)}
                                </span>
                                {!item.isRead ? (
                                  <span className="rounded-full bg-power-orange px-2 py-0.5 text-[10px] font-semibold text-white">
                                    New
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-700">
                                {item.message}
                              </p>
                            </div>

                            <span className="text-xs text-slate-500">
                              {toRelativeTime(item.createdAt)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {actionHref ? (
                              <Link
                                href={actionHref}
                                onClick={() => {
                                  void handleMarkRead(item);
                                }}
                                className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-power-orange hover:bg-slate-50"
                              >
                                Open
                              </Link>
                            ) : null}

                            {!item.isRead ? (
                              <button
                                onClick={() => void handleMarkRead(item)}
                                className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Mark read
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {pages > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => void loadNotifications(Math.max(1, page - 1))}
              disabled={page <= 1 || isLoading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => void loadNotifications(Math.min(pages, page + 1))}
              disabled={page >= pages || isLoading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
