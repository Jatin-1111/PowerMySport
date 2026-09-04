"use client";

import { Booking, IBlockedDate } from "@/types";
import { cn } from "@/utils/cn";
import {
  BOOKING_BLOCK,
  DAY_LABELS,
  HOUR_START,
  HOURS,
  ROW_HEIGHT,
  bookingsForDay,
  formatTime,
  isDateBlocked,
  sameDay,
  timeToMinutes,
  toISODate,
} from "../scheduleUtils";

// ─── Week / Day View (shared time-grid) ──────────────────────────────────────

export function TimeGrid({
  days,
  bookings,
  blockedDates,
  onBookingClick,
}: {
  days: Date[];
  bookings: Booking[];
  blockedDates: IBlockedDate[];
  onBookingClick: (b: Booking) => void;
}) {
  const totalHeight = HOURS.length * ROW_HEIGHT;
  const now = new Date();
  const todayStr = toISODate(now);

  // Current-time indicator position (minutes from HOUR_START)
  const nowMinutesFromStart = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
  const nowTop =
    nowMinutesFromStart >= 0 && nowMinutesFromStart <= HOURS.length * 60
      ? (nowMinutesFromStart / 60) * ROW_HEIGHT
      : null;

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div
        className="sticky top-0 z-10 grid border-b border-slate-100 bg-white"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
      >
        <div className="py-2" />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          return (
            <div key={i} className="py-2 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {DAY_LABELS[d.getDay()]}
              </p>
              <p
                className={cn(
                  "mx-auto mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-power-orange text-white" : "text-slate-700"
                )}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
      >
        {/* Time labels column */}
        <div className="relative select-none" style={{ height: totalHeight }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute flex w-full items-start justify-end pr-2"
              style={{ top: (h - HOUR_START) * ROW_HEIGHT }}
            >
              <span className="-translate-y-1/2 text-[11px] font-medium leading-none text-slate-400">
                {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, ci) => {
          const dayBookings = bookingsForDay(day, bookings);
          const blocked = isDateBlocked(day, blockedDates);
          const isToday = toISODate(day) === todayStr;

          return (
            <div
              key={ci}
              className="relative border-l border-slate-100"
              style={{ height: totalHeight }}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className={cn(
                    "absolute w-full border-t",
                    h % 2 === 0 ? "border-slate-100" : "border-slate-50"
                  )}
                  style={{ top: (h - HOUR_START) * ROW_HEIGHT }}
                />
              ))}

              {/* Half-hour guide lines */}
              {HOURS.map((h) => (
                <div
                  key={`half-${h}`}
                  className="absolute w-full border-t border-dashed border-slate-50"
                  style={{ top: (h - HOUR_START) * ROW_HEIGHT + ROW_HEIGHT / 2 }}
                />
              ))}

              {/* Blocked overlay */}
              {blocked && (
                <div
                  className="pointer-events-none absolute inset-0 z-0"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(244,63,94,0.08) 6px, rgba(244,63,94,0.08) 12px)",
                  }}
                />
              )}

              {/* Current-time indicator */}
              {isToday && nowTop !== null && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                  style={{ top: nowTop }}
                >
                  <span className="bg-power-orange -ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" />
                  <div className="border-power-orange flex-1 border-t-2" />
                </div>
              )}

              {/* Booking blocks */}
              {dayBookings.map((b) => {
                const startMins = timeToMinutes(b.startTime) - HOUR_START * 60;
                const endMins = timeToMinutes(b.endTime) - HOUR_START * 60;
                const top = Math.max(0, (startMins / 60) * ROW_HEIGHT);
                const height = Math.max(28, ((endMins - startMins) / 60) * ROW_HEIGHT - 2);
                const playerName =
                  typeof b.userId === "object" && b.userId
                    ? ((b.userId as { name?: string }).name ?? "")
                    : "";
                const durationMins = endMins - startMins;

                return (
                  <button
                    key={b.id}
                    onClick={() => onBookingClick(b)}
                    className={cn(
                      "absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left",
                      "transition-all hover:z-20 hover:scale-[1.01] hover:shadow-md active:scale-[0.99]",
                      BOOKING_BLOCK[b.status] ?? "border-slate-200 bg-slate-100 text-slate-600"
                    )}
                    style={{ top, height }}
                    title={`${playerName || b.sport} — ${formatTime(b.startTime)} to ${formatTime(b.endTime)}`}
                  >
                    {/* Sport tag */}
                    <p className="truncate text-[10px] font-bold uppercase leading-none tracking-wide opacity-60">
                      {b.sport}
                    </p>
                    {/* Player name */}
                    {height > 24 && (
                      <p className="mt-0.5 truncate text-xs font-semibold leading-tight">
                        {playerName || "Session"}
                      </p>
                    )}
                    {/* Time range — only if tall enough */}
                    {height > 44 && durationMins >= 30 && (
                      <p className="mt-0.5 truncate text-[10px] leading-tight opacity-60">
                        {formatTime(b.startTime)}–{formatTime(b.endTime)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
