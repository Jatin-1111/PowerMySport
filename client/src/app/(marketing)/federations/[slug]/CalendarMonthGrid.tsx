"use client";

import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { CAL_TZ, dateKey } from "./editionUtils";

/**
 * A month grid used as the calendar's date navigator.
 *
 * Weeks start on Monday, not Sunday. That's deliberate: federation calendars are
 * published per week and events overwhelmingly start on a Monday — 116 of AITA's
 * 118 upcoming editions do — so a Monday-first grid stacks them all into the
 * first column, and the weekly rhythm becomes visible at a glance. A list can't
 * show that at all, and a Sunday-first grid buries it in column two.
 *
 * Days without events are rendered but inert. The empty cells are the point:
 * they're what makes "every Monday" legible rather than just asserted.
 */
export function CalendarMonthGrid({
  monthKey,
  editions,
  selectedDate,
  onSelectDate,
}: {
  /** "YYYY-MM" */
  monthKey: string;
  /** Editions already scoped to this month. */
  editions: TournamentEdition[];
  /** "YYYY-MM-DD". A day is always selected — the detail panel is date-scoped. */
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  const countByDate = new Map<string, number>();
  for (const e of editions) {
    const k = dateKey(e.startDate);
    countByDate.set(k, (countByDate.get(k) ?? 0) + 1);
  }

  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay() is 0=Sun; shift so 0=Mon.
  const leadingBlanks = (first.getUTCDay() + 6) % 7;
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: Array<{ day: number; key: string; count: number } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const key = `${yearStr}-${monthStr}-${String(day).padStart(2, "0")}`;
      return { day, key, count: countByDate.get(key) ?? 0 };
    }),
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-400"
          >
            {d.charAt(0)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />;
          const hasEvents = cell.count > 0;
          const isSelected = selectedDate === cell.key;
          const isToday = cell.key === todayKey;

          if (!hasEvents) {
            return (
              <div
                key={cell.key}
                className={`flex h-11 flex-col items-center justify-center rounded-lg text-xs ${
                  isToday ? "ring-1 ring-inset ring-slate-300" : ""
                } text-slate-300`}
              >
                {cell.day}
              </div>
            );
          }

          return (
            <button
              key={cell.key}
              onClick={() => onSelectDate(cell.key)}
              aria-label={`${cell.count} event${cell.count === 1 ? "" : "s"} on ${cell.day} ${first.toLocaleDateString(
                "en-IN",
                { month: "long", timeZone: CAL_TZ },
              )}`}
              aria-pressed={isSelected}
              className={`flex h-11 flex-col items-center justify-center rounded-lg border transition ${
                isSelected
                  ? "border-power-orange bg-power-orange text-white"
                  : "border-orange-200 bg-orange-50 text-power-orange hover:border-power-orange"
              } ${isToday && !isSelected ? "ring-1 ring-inset ring-power-orange/40" : ""}`}
            >
              <span className="text-sm font-bold leading-none">{cell.day}</span>
              <span
                className={`mt-0.5 text-[10px] font-semibold leading-none ${
                  isSelected ? "text-white/80" : "text-power-orange/70"
                }`}
              >
                {cell.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
