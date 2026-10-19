"use client";

import { googleCalendarUrl } from "@/modules/planner/utils/calendarLinks";
import { Badge } from "@/modules/shared/ui/Badge";
import { Button } from "@/modules/shared/ui/Button";
import type { PlannerEdition } from "@powermysport/shared-types";
import { CalendarPlus, ExternalLink, Plus } from "lucide-react";

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
  compact = false,
}: {
  edition: PlannerEdition;
  isPlanned: boolean;
  isAdding: boolean;
  onAdd: () => void;
  /** For a card in a grid of many: one button, and the AITA page as a quiet link.
   *  Google Calendar is left for the plan, where the event has been chosen. */
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {edition.slug &&
        (isPlanned ? (
          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-sm text-slate-700">
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
      {compact && edition.official?.pageUrl && (
        <a
          href={edition.official.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-body decoration-ink/30 hover:text-ink hover:decoration-ink inline-flex min-h-9 items-center gap-1.5 text-sm font-medium underline underline-offset-4 transition-colors duration-300"
          aria-label={`Open ${edition.name} on AITA, where entries are made`}
        >
          AITA page
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        </a>
      )}
      {!compact && edition.official?.pageUrl && (
        <a
          href={edition.official.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          aria-label={`Open ${edition.name} on AITA, where entries are made`}
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Event page on AITA
        </a>
      )}
      {!compact && (
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
      )}
    </div>
  );
}
