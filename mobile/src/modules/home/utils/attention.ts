import type { Href } from "expo-router";
import { calendarOf } from "@/modules/planner/store/plannerStore";
import type { PlannerOverview } from "@/modules/planner/services/planner";
import { longDay, nextUp, nextUpWhen, type NextUpItem } from "@/modules/planner/utils/format";
import {
  daysBetween,
  formatDay,
  windowLine,
  type Opportunity,
} from "@/modules/opportunities/services/opportunities";

/** One thing on the Home page that a parent may need to act on soon. */
export interface AttentionItem {
  id: string;
  kind: "plan" | "opportunity";
  /** Short label for when: "In 3 days", "Tomorrow". */
  when: string;
  title: string;
  line: string;
  /** Whole days from today. Used to sort, and to mark the urgent ones. */
  daysAway: number;
  href: Href;
}

/** Inside this many days, what is closing or opening is worth a place on Home. */
export const OPPORTUNITY_HORIZON_DAYS = 30;
/** Within this many days an item is shown as urgent. */
export const URGENT_DAYS = 7;

function planLine(item: NextUpItem): string {
  const time = item.time ? `, ${item.time}` : "";
  if (item.kind === "enter-by") return `Entries close ${longDay(item.date)}${time}`;
  if (item.kind === "withdraw-by") return `Last day to withdraw ${longDay(item.date)}${time}`;
  if (item.entryClosed) return "Entries have closed for this event";
  return item.underWay ? "Under way now" : `Starts ${longDay(item.date)}`;
}

/** The next things on this child's season plan: entry deadlines, withdrawal deadlines, events. */
export function planAttention(overview: PlannerOverview, today: string): AttentionItem[] {
  if (overview.linkState !== "ready") return [];
  return nextUp({
    entries: overview.plan.entries,
    calendar: calendarOf(overview),
    today,
    limit: 3,
  }).map((item) => ({
    id: `plan-${item.kind}-${item.slug}`,
    kind: "plan" as const,
    when: nextUpWhen(item),
    title: item.name,
    line: planLine(item),
    daysAway: item.underWay ? 0 : item.daysAway,
    // The planner loads the child's season itself; the event screen needs that, so go to the tab.
    href: "/planner" as Href,
  }));
}

const whenText = (days: number): string =>
  days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;

/**
 * Followed entries whose window is about to close, or is about to open. Only what the parent chose
 * to follow, and only inside the horizon: an entry that closes in nine months is not Home's business.
 * `today` is India's date from the same response, so "N days" agrees with the entry's own state.
 */
export function opportunityAttention(
  items: Opportunity[],
  followed: ReadonlySet<string>,
  today: string
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const o of items) {
    if (!followed.has(o.slug)) continue;
    const { cycle } = o;
    if (o.cycleState === "open" && cycle?.closesOn) {
      const days = daysBetween(today, cycle.closesOn);
      if (days >= 0 && days <= OPPORTUNITY_HORIZON_DAYS) {
        out.push({
          id: `opp-${o.slug}`,
          kind: "opportunity",
          when: whenText(days),
          title: o.title,
          line: windowLine(o, today),
          daysAway: days,
          href: { pathname: "/opportunities/[slug]", params: { slug: o.slug } },
        });
      }
    } else if (o.cycleState === "upcoming" && cycle?.opensOn) {
      const days = daysBetween(today, cycle.opensOn);
      if (days >= 0 && days <= OPPORTUNITY_HORIZON_DAYS) {
        out.push({
          id: `opp-${o.slug}`,
          kind: "opportunity",
          when: whenText(days),
          title: o.title,
          line: `Opens ${formatDay(cycle.opensOn)}`,
          daysAway: days,
          href: { pathname: "/opportunities/[slug]", params: { slug: o.slug } },
        });
      }
    }
  }
  return out;
}

/** Soonest first. Ties keep the plan's items ahead of opportunities, since a plan is the parent's own. */
export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  const rank = { plan: 0, opportunity: 1 } as const;
  return [...items].sort((a, b) => a.daysAway - b.daysAway || rank[a.kind] - rank[b.kind]);
}
