"use client";

import { Booking, IBlockedDate } from "@/types";
import { cn } from "@/utils/cn";
import {
  BOOKING_BLOCK,
  DAY_LABELS,
  bookingsForDay,
  formatTime,
  getCalendarRange,
  isDateBlocked,
  sameDay,
} from "../scheduleUtils";

// ─── Month View ───────────────────────────────────────────────────────────────

export function MonthView({
  current,
  bookings,
  blockedDates,
  onDayClick,
  onBookingClick,
}: {
  current: Date;
  bookings: Booking[];
  blockedDates: IBlockedDate[];
  onDayClick: (d: Date) => void;
  onBookingClick: (b: Booking) => void;
}) {
  const { start } = getCalendarRange("month", current);
  const today = new Date();

  const days: Date[] = [];
  const d = new Date(start);
  while (days.length < 42) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  return (
    <div className="flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAY_LABELS.map((l) => (
          <div
            key={l}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {l}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === current.getMonth();
          const isToday = sameDay(day, today);
          const blocked = isDateBlocked(day, blockedDates);
          const dayBookings = bookingsForDay(day, bookings);
          const visible = dayBookings.slice(0, 3);
          const overflow = dayBookings.length - 3;

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative cursor-pointer border-b border-r border-slate-100 p-1.5 transition-colors hover:bg-slate-50",
                !isCurrentMonth && "opacity-40",
                blocked && "bg-rose-50"
              )}
            >
              {blocked && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(244,63,94,0.06) 4px, rgba(244,63,94,0.06) 8px)",
                  }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                  isToday && "bg-power-orange text-white",
                  !isToday && isCurrentMonth && "text-slate-800",
                  !isToday && !isCurrentMonth && "text-slate-400"
                )}
              >
                {day.getDate()}
              </span>
              <div className="relative z-10 mt-0.5 space-y-0.5">
                {visible.map((b) => (
                  <button
                    key={b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBookingClick(b);
                    }}
                    className={cn(
                      "w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium leading-tight",
                      BOOKING_BLOCK[b.status] ?? "bg-slate-100 text-slate-600"
                    )}
                  >
                    {formatTime(b.startTime)}{" "}
                    {typeof b.userId === "object"
                      ? ((b.userId as { name?: string }).name ?? "")
                      : ""}
                  </button>
                ))}
                {overflow > 0 && <p className="px-1 text-xs text-slate-400">+{overflow} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
