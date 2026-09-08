"use client";

import { CalendarDays, List } from "lucide-react";
import type { Booking } from "@/types";
import { cn } from "@/utils/cn";

/**
 * The furniture around the bookings list: the counts strip and the
 * list/calendar switch.
 *
 * Both live here rather than inline in `my-bookings/page.tsx` because that page
 * sits at its line budget (see `tests/oversizedFiles.json`) — anything added
 * there has to buy its space by moving something else out. Keeping the
 * presentational parts in the module is also what let the calendar move off the
 * dashboard without the receiving page growing.
 */

export type BookingsView = "list" | "calendar";

/** Takes the bookings rather than three pre-computed numbers: the counts are
 * derived from nothing else, so deriving them here keeps the page free of
 * variables that exist only to be passed straight back out. */
export function BookingStatsStrip({ bookings }: { bookings: Booking[] }) {
  const now = new Date();
  const stats: Array<{ label: string; value: number }> = [
    { label: "Total", value: bookings.length },
    { label: "Upcoming", value: bookings.filter((b) => new Date(b.date) >= now).length },
    { label: "Confirmed", value: bookings.filter((b) => b.status === "CONFIRMED").length },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, value }) => (
        <div
          key={label}
          className="premium-shadow shop-surface rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

const VIEWS: Array<{ id: BookingsView; label: string; icon: typeof List }> = [
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
];

/** List/calendar toggle. A calendar of bookings is a view of this page's data,
 * not a separate destination, which is why it lives here and not on its own route. */
export function BookingsViewSwitch({
  view,
  onChange,
}: {
  view: BookingsView;
  onChange: (view: BookingsView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Bookings view"
      className="inline-flex rounded-xl border border-slate-200/70 bg-white/70 p-1"
    >
      {VIEWS.map(({ id, label, icon: Icon }) => {
        const isSelected = view === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              isSelected
                ? "bg-power-orange text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
