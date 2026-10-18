"use client";

import type { Notification } from "@/lib/api/notification";
import {
  getCategoryLabel,
  renderNotificationIcon,
} from "@/modules/notifications/config/notificationCategories";
import { getNotificationAction } from "@/modules/notifications/utils/notificationAction";
import { cn } from "@/utils/cn";
import { formatDistanceToNow } from "@/utils/date";
import { Check, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";

const ACTION_LINK =
  "text-ink hover:text-ink-hover focus-visible:ring-ink inline-flex items-center gap-1 rounded-sm text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2";

const ICON_BUTTON =
  "text-ink-muted hover:bg-paper-deep hover:text-ink focus-visible:ring-ink rounded-md p-2 transition-colors focus-visible:outline-none focus-visible:ring-2";

export function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-4 px-1 py-5">
      <div className="bg-paper-deep mt-1 h-4 w-4 shrink-0 animate-pulse rounded" />
      <div className="flex-1 space-y-2.5">
        <div className="bg-paper-deep h-4 w-2/3 animate-pulse rounded" />
        <div className="bg-paper-deep h-3.5 w-full animate-pulse rounded" />
        <div className="bg-paper-deep h-3 w-1/3 animate-pulse rounded" />
      </div>
    </div>
  );
}

/**
 * One notification. Unread is the only thing that gets emphasis: a filled ink dot
 * and a heavier title. The category is a quiet icon and label, never a colour.
 */
export function NotificationRow({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const action = getNotificationAction(notification);
  const isUnread = !notification.isRead;

  return (
    <li className="group relative flex items-start gap-3 px-1 py-5 sm:gap-4">
      <span
        className={cn(
          "mt-[7px] h-2 w-2 shrink-0 rounded-full",
          isUnread ? "bg-ink" : "bg-transparent"
        )}
        aria-hidden="true"
      />
      {renderNotificationIcon(
        notification.category,
        "text-ink-muted mt-1 hidden h-4 w-4 shrink-0 sm:block"
      )}

      <div className="min-w-0 flex-1">
        <p className={cn("text-ink text-pretty leading-snug", isUnread && "font-semibold")}>
          {isUnread && <span className="sr-only">Unread: </span>}
          {notification.title}
        </p>
        <p className="text-ink-body mt-1 line-clamp-2 text-pretty text-sm leading-relaxed">
          {notification.message}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-ink-muted text-sm tabular-nums">
            {getCategoryLabel(notification.category)} ·{" "}
            {formatDistanceToNow(new Date(notification.createdAt))}
          </span>
          {action.external ? (
            <a href={action.href} target="_blank" rel="noreferrer" className={ACTION_LINK}>
              {action.label}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : (
            <Link href={action.href} className={ACTION_LINK}>
              {action.label}
            </Link>
          )}
        </div>
      </div>

      {/* Always visible on touch screens; on desktop they appear on hover or keyboard focus. */}
      <div className="flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
        {isUnread && (
          <button
            type="button"
            onClick={() => onMarkRead(notification._id)}
            aria-label="Mark as read"
            title="Mark as read"
            className={ICON_BUTTON}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(notification._id)}
          aria-label="Delete notification"
          title="Delete"
          className={ICON_BUTTON}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
