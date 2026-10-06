import { dayNumber, type PlannerEdition } from "@powermysport/shared-types";
import type { SeasonPlanEntry } from "@/modules/planner/services/seasonPlan";

/**
 * What a parent should look at next, from their plan and the dates AITA prints.
 *
 * Three kinds of thing are worth a place at the top of the page, and each is dated:
 *
 *   enter-by     entries close for an event on the plan that has not been entered
 *   withdraw-by  the last day to withdraw from an event that has been entered
 *   event        the event itself, from the day it starts until it ends
 *
 * They are merged and sorted by date so the first is "the next thing that needs
 * you". An event with no published deadline contributes no deadline: the page says
 * nothing rather than invent one. Played events and past dates contribute nothing.
 *
 * Pure: today is passed in, so a test and a render agree.
 */

export type NextUpKind = "enter-by" | "withdraw-by" | "event";

export interface NextUpItem {
  kind: NextUpKind;
  slug: string;
  name: string;
  /** `YYYY-MM-DD`: the deadline, or the day the event starts. */
  date: string;
  /** Whole days from today. 0 is today. */
  daysAway: number;
  /** For an event that has already started. */
  underWay: boolean;
  /** AITA's own page for the event, where the entry or withdrawal is made. */
  pageUrl?: string | undefined;
  /** The `HH:MM` IST cut-off AITA prints with a deadline. */
  time?: string | undefined;
}

/** Same day: a deadline first, then the event, because the deadline is what needs doing. */
const ORDER: Record<NextUpKind, number> = { "enter-by": 0, "withdraw-by": 1, event: 2 };

const day = (iso: string): string => iso.slice(0, 10);

export function nextUp(params: {
  entries: SeasonPlanEntry[];
  calendar: Map<string, PlannerEdition>;
  /** `YYYY-MM-DD`. */
  today: string;
  limit?: number;
}): NextUpItem[] {
  const today = dayNumber(params.today);
  const items: NextUpItem[] = [];

  for (const entry of params.entries) {
    if (entry.status === "played") continue;
    const live = params.calendar.get(entry.editionSlug);
    const pageUrl = live?.official?.pageUrl;
    const base = { slug: entry.editionSlug, name: entry.name, pageUrl };

    if (entry.status === "shortlisted" && live?.registrationDeadlineDate) {
      const date = day(live.registrationDeadlineDate);
      if (dayNumber(date) >= today) {
        items.push({
          ...base,
          kind: "enter-by",
          date,
          daysAway: dayNumber(date) - today,
          underWay: false,
          time: live.official?.times?.entryCloses,
        });
      }
    }

    if (entry.status === "entered" && live?.official?.withdrawalDeadline) {
      const date = day(live.official.withdrawalDeadline);
      if (dayNumber(date) >= today) {
        items.push({
          ...base,
          kind: "withdraw-by",
          date,
          daysAway: dayNumber(date) - today,
          underWay: false,
          time: live.official.times?.withdrawal,
        });
      }
    }

    const start = day(entry.startDate);
    const end = day(live?.endDate ?? entry.startDate);
    if (dayNumber(end) >= today) {
      items.push({
        ...base,
        kind: "event",
        date: start,
        daysAway: Math.max(0, dayNumber(start) - today),
        underWay: dayNumber(start) < today,
        pageUrl: undefined,
      });
    }
  }

  return items
    .sort(
      (a, b) =>
        a.daysAway - b.daysAway || ORDER[a.kind] - ORDER[b.kind] || a.slug.localeCompare(b.slug)
    )
    .slice(0, params.limit ?? 3);
}
