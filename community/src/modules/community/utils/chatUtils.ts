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
