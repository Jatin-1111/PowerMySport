import type { Booking, User } from "@/types";

export const formatShortDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * A stable list key. The coach and academy booking endpoints return raw
 * documents, so the id arrives as `_id` and `id` is missing.
 */
export const bookingKey = (booking: Booking, index: number): string =>
  booking.id || (booking as unknown as { _id?: string })._id || `row-${index}`;

/** The client's name: the populated user if the API sent one, else the name on the booking. */
export const bookingPlayerName = (booking: Booking): string => {
  const user = booking.userId;
  if (typeof user === "object" && user !== null && "name" in user) {
    return (user as User).name;
  }
  return booking.participantName || "Player";
};
