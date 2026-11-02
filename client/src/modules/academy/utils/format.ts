import type { Booking, User } from "@/types";

export const formatRupees = (amount: number): string =>
  `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatShortDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Change against last month, as a signed percentage. Null when last month had
 * nothing to compare with, because "up infinity percent" says nothing.
 */
export const monthTrend = (
  thisMonth: number,
  lastMonth: number
): { value: number; positive: boolean } | null => {
  if (lastMonth <= 0) return null;
  return {
    value: ((thisMonth - lastMonth) / lastMonth) * 100,
    positive: thisMonth >= lastMonth,
  };
};

/** A stable list key. `/academies/my/earnings` returns raw documents, so the id arrives as `_id`. */
export const bookingKey = (booking: Booking, index: number): string =>
  booking.id || (booking as unknown as { _id?: string })._id || `row-${index}`;

export const bookingPlayerName = (booking: Booking): string => {
  const user = booking.userId;
  if (typeof user === "object" && user !== null && "name" in user) {
    return (user as User).name;
  }
  return booking.participantName || "Player";
};
