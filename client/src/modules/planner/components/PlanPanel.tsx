"use client";

import { PlanEntryRow } from "@/modules/planner/components/PlanEntryRow";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import {
  downloadIcs,
  eventLocation,
  googleCalendarUrl,
} from "@/modules/planner/utils/calendarLinks";
import { planWarnings } from "@/modules/planner/utils/timeline";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { PlannerEdition } from "@powermysport/shared-types";
import { CalendarPlus, Download } from "lucide-react";

/**
 * The decisions the parent has made, with the calendar and the clashes.
 *
 * The plan stores only the name and date a tournament had when it was chosen
 * (see the SeasonPlan model for why). Anything richer, an end date or a venue,
 * is joined here from the live calendar when it still holds the event, and left
 * out when it does not: a played event that has since left the calendar must
 * still show, just with less.
 */

export function PlanPanel({
  dependentId,
  calendar,
  annualCap,
  bracket,
}: {
  dependentId: string;
  /** Every event the page knows about, to enrich plan entries by slug. */
  calendar: Map<string, PlannerEdition>;
  annualCap: number | null;
  bracket: string;
}) {
  const { entries, isLoading, setStatus, remove } = useSeasonPlan(dependentId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-slate-600">
        Nothing planned yet. Add events from the calendar below and they appear here, in the order
        they happen.
      </p>
    );
  }

  const merged = entries.map((entry) => {
    const live = calendar.get(entry.editionSlug);
    return {
      entry,
      endDate: live?.endDate,
      location: live ? eventLocation(live) : "",
      calendarEvent: {
        slug: entry.editionSlug,
        name: entry.name,
        startDate: entry.startDate,
        endDate: live?.endDate,
        city: live?.city,
        state: live?.state,
        venue: live?.venue,
        ageGroups: live?.ageGroups,
        registrationDeadlineDate: live?.registrationDeadlineDate,
      },
    };
  });

  const warnings = new Map(
    planWarnings(
      merged.map(({ entry, endDate }) => ({
        slug: entry.editionSlug,
        name: entry.name,
        startDate: entry.startDate,
        endDate,
      }))
    ).map((warning) => [warning.slug, warning.message])
  );

  // The allowance counts entries in the calendar year, which is AITA's window.
  // It counts what is on THIS plan, not what the child has entered elsewhere,
  // and the line says so.
  const thisYear = new Date().getUTCFullYear();
  const countedThisYear = entries.filter(
    (entry) => new Date(entry.startDate).getUTCFullYear() === thisYear
  ).length;

  const upcoming = merged.filter(({ entry }) => entry.status !== "played");

  return (
    <div>
      <ul>
        {merged.map(({ entry, endDate, location, calendarEvent }) => (
          <PlanEntryRow
            key={entry.editionSlug}
            entry={entry}
            endDate={endDate}
            location={location || undefined}
            warning={warnings.get(entry.editionSlug)}
            busy={setStatus.isPending || remove.isPending}
            onAdvance={(status) => setStatus.mutate({ editionSlug: entry.editionSlug, status })}
            onRemove={() => remove.mutate(entry.editionSlug)}
            extraActions={
              entry.status !== "played" && (
                <a
                  href={googleCalendarUrl(calendarEvent)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Add ${entry.name} to Google Calendar`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Google Calendar</span>
                </a>
              )
            }
          />
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs leading-relaxed text-slate-600">
          {annualCap
            ? `${countedThisYear} of ${annualCap} yearly entries in ${bracket} are on this plan. Playing up uses the same allowance.`
            : `${countedThisYear} event${countedThisYear === 1 ? "" : "s"} on this plan for ${thisYear}.`}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={upcoming.length === 0}
          onClick={() => downloadIcs(upcoming.map((item) => item.calendarEvent))}
        >
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          Download calendar file
        </Button>
      </div>
    </div>
  );
}
