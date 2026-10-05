"use client";

import { googleCalendarUrl } from "@/modules/planner/utils/calendarLinks";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import type { PlannerEdition } from "@powermysport/shared-types";
import { CalendarPlus, Plus } from "lucide-react";

/**
 * The two things a parent can do with an event they can enter: keep the date, and
 * put it on the plan. One component so the timeline and the suggestions offer the
 * same actions in the same words.
 */
export function EventActions({
  edition,
  isPlanned,
  isAdding,
  onAdd,
}: {
  edition: PlannerEdition;
  isPlanned: boolean;
  isAdding: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={googleCalendarUrl(edition)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        aria-label={`Add ${edition.name} to Google Calendar`}
      >
        <CalendarPlus className="h-4 w-4" aria-hidden />
        Google Calendar
      </a>
      {edition.slug &&
        (isPlanned ? (
          <Badge className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">
            On the plan
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isAdding}
            onClick={onAdd}
            aria-label={`Add ${edition.name} to the plan`}
          >
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            Add to plan
          </Button>
        ))}
    </div>
  );
}
