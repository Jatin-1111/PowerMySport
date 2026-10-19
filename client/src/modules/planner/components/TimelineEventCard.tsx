"use client";

import { deadlineState } from "@/modules/planner/utils/timeline";
import { EventActions } from "@/modules/planner/components/EventActions";
import { DeadlineLine } from "@/modules/planner/components/DeadlineLine";
import { formatEventWindow } from "@/modules/planner/utils/eventFormat";
import { ReachNote } from "@/modules/planner/components/ReachNote";
import { Badge } from "@/modules/shared/ui/Badge";
import type { PlannerEntry, ReachVerdict } from "@powermysport/shared-types";
import { Info, MapPin } from "lucide-react";
import Link from "next/link";

/**
 * One event a child can enter, with the three things a parent needs from it:
 * what it is, whether it is worth acting on soon, and how to keep the date.
 *
 * Closed events render the same card without the actions, with the rule that
 * closes them in place of the notes, so a parent can see WHY and not just that.
 */

export function TimelineEventCard({
  entry,
  mode,
  isPlanned,
  isAdding,
  onAdd,
  verdict,
}: {
  entry: PlannerEntry;
  mode: "open" | "closed";
  isPlanned: boolean;
  isAdding: boolean;
  onAdd: () => void;
  /** What past draws showed for this event, when they showed anything. */
  verdict?: ReachVerdict | undefined;
}) {
  const { edition } = entry;
  // An event whose entries have already closed cannot be entered, so offering to
  // plan it would put something on the list that the entry desk will refuse. It
  // stays visible, with the date it closed, so the parent sees why it is quiet.
  const entriesClosed = deadlineState(edition.registrationDeadlineDate).kind === "passed";
  const location = [edition.city, edition.state].filter(Boolean).join(", ");

  return (
    <li className="border-hairline flex h-full flex-col rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p
            className={
              mode === "open"
                ? "text-ink text-sm font-semibold"
                : "text-ink-body text-sm font-semibold"
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
          <p className="text-ink-body mt-0.5 text-xs">
            {formatEventWindow(edition.startDate, edition.endDate)}
          </p>
        </div>
      </div>

      <div className="text-ink-body mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {location}
          </span>
        )}
        {edition.ladder && <span>{edition.ladder}</span>}
        {entry.playingUp && (
          <Badge
            variant="outline"
            className="border-hairline bg-paper-deep/50 text-ink-body text-[11px]"
          >
            Older age group
          </Badge>
        )}
      </div>

      {mode === "open" ? (
        <>
          {verdict && (
            <div className="mt-2">
              <ReachNote verdict={verdict} />
            </div>
          )}
          <p className="mt-2 text-xs">
            <DeadlineLine deadline={edition.registrationDeadlineDate} />
          </p>
          {entry.notes.length > 0 && (
            <p className="text-ink-body mt-2 flex gap-1.5 text-xs leading-relaxed">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{entry.notes.join(" ")}</span>
            </p>
          )}
        </>
      ) : (
        <p className="text-ink-body mt-2 text-xs leading-relaxed">{entry.reason}</p>
      )}

      {mode === "open" && !entriesClosed && (
        <div className="mt-auto pt-4">
          <EventActions
            edition={edition}
            isPlanned={isPlanned}
            isAdding={isAdding}
            onAdd={onAdd}
            compact
          />
        </div>
      )}
    </li>
  );
}
