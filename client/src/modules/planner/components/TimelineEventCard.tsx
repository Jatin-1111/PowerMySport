"use client";

import { deadlineState } from "@/modules/planner/utils/timeline";
import { EventActions } from "@/modules/planner/components/EventActions";
import { formatEventWindow, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { Badge } from "@/modules/shared/ui/Badge";
import type { PlannerEntry } from "@powermysport/shared-types";
import { Info, MapPin } from "lucide-react";
import Link from "next/link";

/**
 * One event a child can enter, with the three things a parent needs from it:
 * what it is, whether it is worth acting on soon, and how to keep the date.
 *
 * Closed events render the same card without the actions, with the rule that
 * closes them in place of the notes, so a parent can see WHY and not just that.
 */

function DeadlineLine({ deadline }: { deadline: string | null | undefined }) {
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
      Entries close {formatLongDate(state.date)} ({when})
    </span>
  );
}

export function TimelineEventCard({
  entry,
  mode,
  isPlanned,
  isAdding,
  onAdd,
}: {
  entry: PlannerEntry;
  mode: "open" | "closed";
  isPlanned: boolean;
  isAdding: boolean;
  onAdd: () => void;
}) {
  const { edition } = entry;
  // An event whose entries have already closed cannot be entered, so offering to
  // plan it would put something on the list that the entry desk will refuse. It
  // stays visible, with the date it closed, so the parent sees why it is quiet.
  const entriesClosed = deadlineState(edition.registrationDeadlineDate).kind === "passed";
  const location = [edition.city, edition.state].filter(Boolean).join(", ");

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p
            className={
              mode === "open"
                ? "text-sm font-semibold text-slate-900"
                : "text-sm font-semibold text-slate-600"
            }
          >
            {edition.slug ? (
              <Link href={`/tournaments/${edition.slug}`} className="hover:underline">
                {edition.name}
              </Link>
            ) : (
              edition.name
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {formatEventWindow(edition.startDate, edition.endDate)}
          </p>
        </div>

        {mode === "open" && !entriesClosed && (
          <EventActions edition={edition} isPlanned={isPlanned} isAdding={isAdding} onAdd={onAdd} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {location}
          </span>
        )}
        {edition.ladder && <span>{edition.ladder}</span>}
        {entry.playingUp && (
          <Badge className="border-slate-200 bg-slate-50 text-[11px] text-slate-600">
            Playing up
          </Badge>
        )}
      </div>

      {mode === "open" ? (
        <>
          <p className="mt-2 text-xs">
            <DeadlineLine deadline={edition.registrationDeadlineDate} />
          </p>
          {entry.notes.length > 0 && (
            <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-slate-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{entry.notes.join(" ")}</span>
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{entry.reason}</p>
      )}
    </li>
  );
}
