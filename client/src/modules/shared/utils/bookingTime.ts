import type { Booking } from "@/types";

const ACTIVE_STATUSES = new Set(["CONFIRMED", "IN_PROGRESS"]);

/**
 * When a session starts or ends on the provider's own clock. Bookings store the
 * day as a UTC midnight date and the times as "HH:mm", so the two are joined
 * here. Null when a booking has no usable time.
 */
export const bookingMoment = (booking: Booking, which: "start" | "end"): Date | null => {
  const time = which === "start" ? booking.startTime : booking.endTime;
  if (!booking.date || !time) return null;
  const moment = new Date(`${String(booking.date).slice(0, 10)}T${time}:00`);
  return Number.isNaN(moment.getTime()) ? null : moment;
};

const startTime = (booking: Booking): number =>
  bookingMoment(booking, "start")?.getTime() ?? Number.MAX_SAFE_INTEGER;

/** Requests waiting on the provider, soonest session first. */
export const selectRequests = (bookings: Booking[]): Booking[] =>
  bookings
    .filter((b) => b.status === "AWAITING_PROVIDER")
    .sort((a, b) => startTime(a) - startTime(b));

/** Confirmed sessions that have not finished yet, soonest first. */
export const selectUpcoming = (bookings: Booking[], now: Date, limit = 5): Booking[] =>
  bookings
    .filter((b) => {
      if (!ACTIVE_STATUSES.has(b.status)) return false;
      const end = bookingMoment(b, "end") ?? bookingMoment(b, "start");
      return end ? end.getTime() >= now.getTime() : false;
    })
    .sort((a, b) => startTime(a) - startTime(b))
    .slice(0, limit);

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Today", "Tomorrow", "Wed, 5 Nov", or with the year when it is not this year. */
export const dayLabel = (day: Date, now: Date): string => {
  if (sameDay(day, now)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(day, tomorrow)) return "Tomorrow";
  return day.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(day.getFullYear() === now.getFullYear() ? {} : { year: "numeric" as const }),
  });
};

/** "17:30" becomes "5:30 pm". Anything that is not HH:mm is returned as it came. */
export const clockLabel = (hhmm: string): string => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "pm" : "am";
  return `${hour % 12 === 0 ? 12 : hour % 12}:${match[2]} ${suffix}`;
};

export const timeRange = (booking: Booking): string =>
  booking.startTime && booking.endTime
    ? `${clockLabel(booking.startTime)} to ${clockLabel(booking.endTime)}`
    : booking.startTime
      ? clockLabel(booking.startTime)
      : "";

/** The line under a session: when it is, in words. */
export const whenLabel = (booking: Booking, now: Date): string => {
  const start = bookingMoment(booking, "start");
  const day = start ? dayLabel(start, now) : "";
  return [day, timeRange(booking)].filter(Boolean).join(", ");
};
