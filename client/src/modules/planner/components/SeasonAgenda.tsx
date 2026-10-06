"use client";

import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import { eventLocation } from "@/modules/planner/utils/calendarLinks";
import { formatEventWindow, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { itemLabel } from "@/modules/planner/utils/itemLabel";
import { OPEN_BADGE, STATUS_BADGE, SUGGESTED_BADGE } from "@/modules/planner/utils/statusStyle";
import { STATUS_LABEL } from "@/modules/planner/services/seasonPlan";
import { deadlineState, groupByMonth } from "@/modules/planner/utils/timeline";
import { cn } from "@/utils/cn";
import { AlertTriangle, Check } from "lucide-react";

/**
 * The season as a list, in date order, grouped by month.
 *
 * It is what a phone shows, because seven narrow columns of week grid cannot hold a
 * readable event name, and it is a choice on a wide screen for a parent who would
 * rather read than scan. It shows exactly the events the grid does, in the same
 * colours, and opens the same detail.
 */

const STRIPE: Record<CalendarItem["kind"], string> = {
  planned: "border-l-slate-800",
  suggested: "border-l-orange-500",
  available: "border-l-slate-300",
};

function stateChip(item: CalendarItem): { label: string; tone: string } {
  if (item.kind === "planned") {
    const status = item.status ?? "shortlisted";
    return { label: STATUS_LABEL[status], tone: STATUS_BADGE[status] };
  }
  if (item.kind === "suggested") {
    return {
      label: item.tier === "consider" ? "Worth considering" : "Suggested",
      tone: SUGGESTED_BADGE,
    };
  }
  return { label: "Open to enter", tone: OPEN_BADGE };
}

/** The deadline, only when it is still ahead and worth acting on. */
function closing(item: CalendarItem): string | null {
  if (item.kind === "planned" && item.status !== "shortlisted") return null;
  const state = deadlineState(item.edition.registrationDeadlineDate);
  if (state.kind !== "soon" && state.kind !== "open") return null;
  return `Entries close ${formatLongDate(state.date)}`;
}

export function SeasonAgenda({
  items,
  selectedSlug,
  onSelect,
}: {
  items: CalendarItem[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
}) {
  const upcoming = [...items]
    .filter((item) => !(item.kind === "planned" && item.status === "played"))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.slug.localeCompare(b.slug));
  const played = items.filter((item) => item.kind === "planned" && item.status === "played");
  const months = groupByMonth(upcoming, (item) => item.startDate);

  if (items.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-slate-600">
        Nothing is on the plan yet. Add events from the suggestions, or turn on every event they can
        enter, and they appear here by date.
      </p>
    );
  }

  const row = (item: CalendarItem) => {
    const chip = stateChip(item);
    const where = eventLocation({ ...item.edition, venue: undefined });
    const deadline = closing(item);
    return (
      <li key={item.slug}>
        <button
          type="button"
          onClick={() => onSelect(item.slug)}
          aria-label={itemLabel(item)}
          aria-pressed={item.slug === selectedSlug}
          className={cn(
            "flex min-h-14 w-full items-start justify-between gap-3 rounded-lg border border-l-4 border-slate-200 bg-white px-3 py-2.5 text-left hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
            STRIPE[item.kind],
            item.hasOverlap && "border-red-300",
            item.slug === selectedSlug && "ring-2 ring-orange-500"
          )}
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-snug text-slate-900">
              {item.name}
            </span>
            <span className="mt-0.5 block text-xs text-slate-600">
              {formatEventWindow(item.startDate, item.endDate)}
              {where ? ` · ${where}` : ""}
            </span>
            {deadline && <span className="mt-0.5 block text-xs text-amber-800">{deadline}</span>}
            {item.hasOverlap && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-red-700">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                Overlaps another planned event
              </span>
            )}
          </span>
          <span
            className={cn(
              "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold",
              chip.tone
            )}
          >
            {item.kind === "planned" && item.status === "entered" && (
              <Check className="h-3 w-3" aria-hidden />
            )}
            {chip.label}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      {months.map((month) => (
        <div key={month.key}>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            {month.label}
          </h3>
          <ul className="space-y-2">{month.items.map(row)}</ul>
        </div>
      ))}
      {played.length > 0 && (
        <div>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
            Played
          </h3>
          <ul className="space-y-2">{played.map(row)}</ul>
        </div>
      )}
    </div>
  );
}
