import { Booking, IBlockedDate } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const HOUR_START = 6;
export const HOUR_END = 22;
export const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
export const ROW_HEIGHT = 64; // px per hour

export type CalendarView = "month" | "week" | "day";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function timeToMinutes(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return parseInt(h) * 60 + parseInt(m);
}

export function formatTime(t: string): string {
  const mins = timeToMinutes(t);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${suffix}`;
}

export function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getWeekStart(d: Date): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay());
  dt.setHours(0, 0, 0, 0);
  return dt;
}

export function getCalendarRange(view: CalendarView, current: Date): { start: Date; end: Date } {
  if (view === "day") {
    const start = new Date(current);
    start.setHours(0, 0, 0, 0);
    const end = new Date(current);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (view === "week") {
    const start = getWeekStart(current);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // month — include leading/trailing days for a full 6-week grid
  const start = new Date(current.getFullYear(), current.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function isDateBlocked(d: Date, blocks: IBlockedDate[]): boolean {
  const ts = d.getTime();
  return blocks.some((b) => {
    const s = new Date(b.startDate).setHours(0, 0, 0, 0);
    const e = new Date(b.endDate).setHours(23, 59, 59, 999);
    return ts >= s && ts <= e;
  });
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function bookingsForDay(day: Date, bookings: Booking[]): Booking[] {
  return bookings.filter((b) => sameDay(new Date(b.date), day));
}

export const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  AWAITING_PROVIDER: "Awaiting Approval",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired — Refunded",
};

export const STATUS_BADGE: Record<string, string> = {
  AWAITING_PAYMENT: "bg-slate-50 text-slate-600 border border-slate-200",
  AWAITING_PROVIDER: "bg-amber-50 text-amber-700 border border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  COMPLETED: "bg-slate-100 text-slate-600 border border-slate-200",
  NO_SHOW: "bg-rose-50 text-rose-600 border border-rose-200",
  CANCELLED: "bg-red-50 text-red-600 border border-red-200",
  EXPIRED: "bg-red-50 text-red-600 border border-red-200",
};

export const BOOKING_BLOCK: Record<string, string> = {
  AWAITING_PAYMENT: "bg-slate-100 border-slate-300 text-slate-700",
  AWAITING_PROVIDER: "bg-amber-100 border-amber-300 text-amber-800",
  CONFIRMED: "bg-emerald-100 border-emerald-300 text-emerald-800",
  IN_PROGRESS: "bg-indigo-100 border-indigo-300 text-blue-800",
  COMPLETED: "bg-slate-100 border-slate-200 text-slate-600",
  NO_SHOW: "bg-rose-100 border-rose-200 text-rose-700",
  EXPIRED: "bg-red-100 border-red-200 text-red-700",
};
