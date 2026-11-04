"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
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
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startAt = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const diffDays = Math.round((startToday.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24));

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
    return `/questions/${item.data.postId}`;
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
    [items]
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items]
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
    async (targetPage = 1, isBackground = false) => {
      try {
        if (!isBackground) setIsLoading(true);
        const response = await communityService.listCommunityNotifications(
          targetPage,
          PAGE_SIZE,
          filter === "UNREAD" ? false : undefined
        );

        setItems(response.items || []);
        setPage(targetPage);
        setPages(Math.max(1, response.pagination.pages || 1));
      } catch {
        if (!isBackground) {
          setItems([]);
          setPage(targetPage);
          setPages(1);
        }
        toast.error("Failed to load notifications");
      } finally {
        if (!isBackground) setIsLoading(false);
      }
    },
    [filter]
  );

  const handleMarkRead = useCallback(async (item: CommunityActivityItem) => {
    if (item.isRead) {
      return;
    }

    try {
      await communityService.markCommunityNotificationRead(item.id);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry))
      );
    } catch {
      toast.error("We could not mark that as read");
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
      toast.error("We could not mark them as read");
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
      void communityService.clearNotificationCache();
      void loadNotifications(1, true);
    };

    socket.on("notification:new", refresh);
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("notification:new", refresh);
    };
  }, [loadNotifications]);

  const link =
    "text-ink decoration-ink/30 hover:decoration-ink min-h-11 inline-flex items-center text-base font-semibold underline underline-offset-4 transition-colors duration-200";

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap-narrow">
        <CommunityPageHeader
          title="Notifications"
          subtitle="Answers, upvotes, requests and messages from the community."
          badge="Your account"
          action={
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0 || isMarkingAll}
              className="btn-motion border-ink text-ink hover:bg-ink disabled:hover:text-ink inline-flex min-h-11 items-center rounded-md border px-5 text-base font-semibold hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              {isMarkingAll ? "Marking" : "Mark all read"}
            </button>
          }
        />

        <div className="mt-10">
          <div
            role="tablist"
            aria-label="Filter notifications"
            className="border-hairline flex gap-8 border-b"
          >
            {(
              [
                { value: "ALL", label: "All" },
                { value: "UNREAD", label: unreadCount > 0 ? `Unread (${unreadCount})` : "Unread" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={filter === tab.value}
                onClick={() => setFilter(tab.value)}
                className={`-mb-px min-h-12 border-b-2 text-base font-semibold tabular-nums transition-colors duration-200 ${
                  filter === tab.value
                    ? "border-ink text-ink"
                    : "text-ink-muted hover:text-ink border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div aria-busy="true" aria-label="Loading notifications" className="mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-hairline space-y-3 border-b py-6">
                  <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
                  <div className="bg-ink/10 h-5 w-2/3 animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-paper-deep mt-8 rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">
                {filter === "UNREAD" ? "You are all caught up." : "Nothing yet."}
              </p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                Answers, upvotes, requests and messages will show up here.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-12">
              {groupedItems.map((dateGroup) => (
                <section key={dateGroup.dateKey} aria-label={dateGroup.heading}>
                  <h2 className="font-editorial text-ink text-2xl font-normal">
                    {dateGroup.heading}
                  </h2>
                  <ul className="border-hairline mt-3 border-t">
                    {dateGroup.typeGroups.flatMap((typeGroup) =>
                      typeGroup.items.map((item) => {
                        const actionHref = buildActionHref(item);
                        return (
                          <li key={item.id} className="border-hairline border-b py-5">
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                                  item.isRead ? "bg-transparent" : "bg-power-orange-solid"
                                }`}
                                aria-label={item.isRead ? undefined : "Unread"}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-ink-muted text-sm">
                                  {getEventLabel(item) !== typeGroup.label
                                    ? `${typeGroup.label} · ${getEventLabel(item)} · `
                                    : `${typeGroup.label} · `}
                                  {toRelativeTime(item.createdAt)}
                                </p>
                                <p
                                  className={`mt-1 text-lg leading-snug ${
                                    item.isRead ? "text-ink-body" : "text-ink font-semibold"
                                  }`}
                                >
                                  {item.title}
                                </p>
                                <p className="text-ink-body mt-1 max-w-[60ch] text-base leading-relaxed">
                                  {item.message}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-6">
                                  {actionHref ? (
                                    <Link
                                      href={actionHref}
                                      onClick={() => {
                                        void handleMarkRead(item);
                                      }}
                                      className={link}
                                    >
                                      Open
                                    </Link>
                                  ) : null}
                                  {!item.isRead ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleMarkRead(item)}
                                      className="text-ink-muted hover:text-ink min-h-11 text-base font-medium transition-colors duration-200"
                                    >
                                      Mark read
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {pages > 1 ? (
            <div className="mt-10 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => void loadNotifications(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
                className={`${link} disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40`}
              >
                Previous
              </button>
              <span className="text-ink-muted text-sm tabular-nums">
                Page {page} of {pages}
              </span>
              <button
                type="button"
                onClick={() => void loadNotifications(Math.min(pages, page + 1))}
                disabled={page >= pages || isLoading}
                className={`${link} disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40`}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
