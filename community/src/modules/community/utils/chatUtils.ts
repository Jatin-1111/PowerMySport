import type { CommunityUserSearchResult } from "@/modules/community/types";

export const MESSAGE_EDIT_DELETE_WINDOW_MS = 30 * 60 * 1000;

export const messageTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export const getRelativeTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

export const getMessageTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return messageTimeFormatter.format(date);
};

export const formatLastSeen = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timeStr = messageTimeFormatter.format(date);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  let dateStr = "";
  if (diffHours < 24 && now.getDate() === date.getDate()) {
    dateStr = "today";
  } else {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      dateStr = "yesterday";
    } else {
      dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
    }
  }

  return `last seen ${dateStr} at ${timeStr}`;
};

export const formatChatListDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return messageTimeFormatter.format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return "Yesterday";
  }

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
};

export const getAvatarCharacter = (value?: string | null): string => {
  const normalized = (value || "").trim();
  if (!normalized) return "?";
  return normalized.charAt(0).toUpperCase();
};

export const formatAgeLabel = (age?: number | null): string => {
  if (typeof age !== "number" || Number.isNaN(age) || age <= 0) return "";
  return `${age}y`;
};

export const formatUserMeta = (user: CommunityUserSearchResult): string => {
  const parts = [user.city?.trim(), formatAgeLabel(user.age)].filter(Boolean);
  return parts.join(" • ");
};

export const isWithinMessageEditWindow = (
  createdAt?: string | null,
): boolean => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= MESSAGE_EDIT_DELETE_WINDOW_MS;
};

export const getLastSeenTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  const timeString = messageTimeFormatter.format(date);

  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return `today at ${timeString}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `yesterday at ${timeString}`;
  }

  const dateString = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear().toString().slice(-2)}`;
  return `${dateString} at ${timeString}`;
};
