"use client";

import { CostLine } from "@/modules/planner/components/CostLine";
import { PlanEntryRow } from "@/modules/planner/components/PlanEntryRow";
import type { CostResponse } from "@/modules/planner/services/planner";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import { eventLocation, googleCalendarUrl } from "@/modules/planner/utils/calendarLinks";
import { planWarnings } from "@/modules/planner/utils/timeline";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { PlannerEdition } from "@powermysport/shared-types";
import { CalendarPlus } from "lucide-react";

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
  costs,
  costsLoading,
  yearlyLimit,
}: {
  dependentId: string;
  /** Every event the page knows about, to enrich plan entries by slug. */
  calendar: Map<string, PlannerEdition>;
  /** Travel and stay for the plan, once the server has priced it. */
  costs: CostResponse | null;
  costsLoading: boolean;
  /** How many events AITA lets this age group play in a year, where it says. */
  yearlyLimit: { cap: number | null; ageGroup: string };
}) {
  const { entries, isLoading, setStatus, remove, setCosts } = useSeasonPlan(dependentId);

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
        Nothing planned yet. Add events from the suggestions or the calendar and they appear here,
        in the order they happen.
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

  const thisYear = new Date().getUTCFullYear();
  const countedThisYear = entries.filter(
    (entry) => new Date(entry.startDate).getUTCFullYear() === thisYear
  ).length;
  const { cap, ageGroup } = yearlyLimit;

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-slate-600">
        {cap
          ? `AITA lets a player in ${ageGroup} play up to ${cap} events a year. ${countedThisYear} ${countedThisYear === 1 ? "is" : "are"} on this plan. Events in an older age group count towards this too.`
          : `${countedThisYear} event${countedThisYear === 1 ? "" : "s"} on this plan for ${thisYear}.`}
      </p>
      <ul>
        {merged.map(({ entry, endDate, location, calendarEvent }) => (
          <PlanEntryRow
            key={entry.editionSlug}
            entry={entry}
            endDate={endDate}
            location={location || undefined}
            warning={warnings.get(entry.editionSlug)}
            details={
              entry.status === "played" ? undefined : (
                <CostLine
                  cost={costs?.events[entry.editionSlug]}
                  loading={costsLoading}
                  yours={entry.costs}
                  saving={setCosts.isPending}
                  onSave={(figures) =>
                    setCosts.mutate({ editionSlug: entry.editionSlug, costs: figures })
                  }
                />
              )
            }
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
                  <span>Google Calendar</span>
                </a>
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}
