import type { StatusTone } from "@/modules/shared/ui/StatusTag";
import type { Booking } from "@/types";
import { bookingMoment } from "./bookingTime";

export type BookingFilter = "upcoming" | "past" | "all";

/** A request is the one status that is waiting on the coach. */
export const isRequest = (booking: Booking): boolean => booking.status === "AWAITING_PROVIDER";

const UPCOMING_STATUSES = new Set([
  "CONFIRMED",
  "IN_PROGRESS",
  "AWAITING_PAYMENT",
  "PENDING_INVITES",
]);

const startOf = (booking: Booking): number => bookingMoment(booking, "start")?.getTime() ?? 0;

/**
 * The sessions under the requests section. Requests are shown on their own, so
 * they are never repeated here. Upcoming runs soonest first; the rest, most
 * recent first.
 */
export const filterSessions = (bookings: Booking[], filter: BookingFilter): Booking[] => {
  const sessions = bookings.filter((booking) => !isRequest(booking));
  const matching =
    filter === "upcoming"
      ? sessions.filter((b) => UPCOMING_STATUSES.has(b.status))
      : filter === "past"
        ? sessions.filter((b) => !UPCOMING_STATUSES.has(b.status))
        : sessions;
  return [...matching].sort((a, b) =>
    filter === "upcoming" ? startOf(a) - startOf(b) : startOf(b) - startOf(a)
  );
};

export const countByFilter = (bookings: Booking[]): Record<BookingFilter, number> => ({
  upcoming: filterSessions(bookings, "upcoming").length,
  past: filterSessions(bookings, "past").length,
  all: filterSessions(bookings, "all").length,
});

/** Requests, soonest session first. */
export const requestsOf = (bookings: Booking[]): Booking[] =>
  bookings.filter(isRequest).sort((a, b) => startOf(a) - startOf(b));

export interface BookingStatusView {
  tone: StatusTone;
  tag: string;
}

/** The word on a booking's tag. The tone only reinforces it. */
export const bookingStatusView = (status: Booking["status"]): BookingStatusView => {
  switch (status) {
    case "CONFIRMED":
      return { tone: "live", tag: "Confirmed" };
    case "IN_PROGRESS":
      return { tone: "live", tag: "In progress" };
    case "COMPLETED":
      return { tone: "neutral", tag: "Completed" };
    case "AWAITING_PROVIDER":
      return { tone: "pending", tag: "Needs your reply" };
    case "AWAITING_PAYMENT":
      return { tone: "pending", tag: "Awaiting payment" };
    case "PENDING_INVITES":
      return { tone: "pending", tag: "Waiting for invites" };
    case "NO_SHOW":
      return { tone: "alert", tag: "No show" };
    default:
      return { tone: "alert", tag: "Cancelled" };
  }
};
