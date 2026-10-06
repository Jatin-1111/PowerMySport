"use client";

import { formatClockTime, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { deadlineState } from "@/modules/planner/utils/timeline";

/**
 * Where an event's entry deadline stands, in words.
 *
 * One component so every place that mentions a deadline says the same thing in the
 * same way: the timeline cards and the calendar's event detail.
 */
export function DeadlineLine({
  deadline,
  time,
}: {
  deadline: string | null | undefined;
  /** `HH:MM` IST as AITA prints it, when it prints one. */
  time?: string | undefined;
}) {
  const state = deadlineState(deadline);
  if (state.kind === "unpublished") {
    // Said, not omitted: an empty space reads as "no deadline", which is the
    // opposite of what is true. The federation just has not printed one.
    return <span className="text-slate-500">Entry deadline not published</span>;
  }
  if (state.kind === "passed") {
    return <span className="text-slate-500">Entries closed {formatLongDate(state.date)}</span>;
  }
  const when =
    state.daysLeft === 0
      ? "today"
      : state.daysLeft === 1
        ? "tomorrow"
        : `in ${state.daysLeft} days`;
  return (
    <span className={state.kind === "soon" ? "font-semibold text-amber-700" : "text-slate-600"}>
      Entries close {formatLongDate(state.date)}
      {time ? `, ${formatClockTime(time)}` : ""} ({when})
    </span>
  );
}
