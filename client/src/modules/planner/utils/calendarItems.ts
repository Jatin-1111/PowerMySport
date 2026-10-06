import {
  clearDaysBetween,
  planWarnings,
  type PlannerEdition,
  type PlannerEntry,
  type Shortlist,
} from "@powermysport/shared-types";
import type { RecommendationItem } from "@/modules/planner/services/planner";
import type { SeasonPlanEntry, SeasonPlanEntryStatus } from "@/modules/planner/services/seasonPlan";

/**
 * Which events the calendar shows, and what state each one is in.
 *
 * The page already holds three views of the same events: what the child can enter,
 * what has been suggested, and what is on the plan. A calendar that drew all three
 * as equals would be a wall of bars, so each event gets exactly one state here and
 * the calendar draws that:
 *
 *   planned    on the plan (solid): the thing the parent has decided
 *   suggested  suggested and not yet planned (dashed): a proposal
 *   available  open to enter, neither of the above (outline): quiet, and optional
 *
 * An event on the plan is always "planned", even if it was also suggested or is
 * also open, because a decision outranks advice. Events the child cannot enter are
 * not drawn: the list under the calendar explains why, and a calendar of things
 * they cannot do is noise.
 */

export type CalendarItemKind = "planned" | "suggested" | "available";

export interface CalendarItem {
  slug: string;
  name: string;
  startDate: string;
  endDate?: string | undefined;
  kind: CalendarItemKind;
  /** Plan status, for a planned item. */
  status?: SeasonPlanEntryStatus | undefined;
  tier?: RecommendationItem["tier"] | undefined;
  /** Why it was suggested, in the words the planner gave. */
  reason?: string | undefined;
  /**
   * Always present. For an event the live calendar no longer holds, a minimal one
   * built from the plan entry, so a played event still draws and still has a link.
   */
  edition: PlannerEdition;
  /** The entry rules' verdict, when the live calendar holds the event. */
  verdict?: PlannerEntry | undefined;
  planEntry?: SeasonPlanEntry | undefined;
  /** Plain sentences about overlaps and tight gaps with other planned events. */
  clashes: string[];
  /** True only for a real overlap, which the calendar draws as a problem. */
  hasOverlap: boolean;
}

const bySlug = (entries: PlannerEntry[]): Array<[string, PlannerEntry]> =>
  entries.filter((entry) => entry.edition.slug).map((entry) => [entry.edition.slug!, entry]);

const byStart = (a: CalendarItem, b: CalendarItem): number =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime() || a.slug.localeCompare(b.slug);

/** Overlaps and tight gaps between events on the plan, and who each one touches. */
function markClashes(items: CalendarItem[]): void {
  const planned = items.filter((item) => item.kind === "planned" && item.status !== "played");

  // The later event of each adjacent pair carries the message, as on the plan list.
  const messages = new Map<string, string[]>();
  for (const warning of planWarnings(
    planned.map((item) => ({
      slug: item.slug,
      name: item.name,
      startDate: item.startDate,
      endDate: item.endDate,
    }))
  )) {
    messages.set(warning.slug, [...(messages.get(warning.slug) ?? []), warning.message]);
  }

  const sorted = [...planned].sort(byStart);
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const earlier = sorted[i]!;
      const later = sorted[j]!;
      if (clearDaysBetween(earlier, later) >= 0) continue;
      // Both events are in the clash, so both are marked, and the earlier one is
      // told too: the parent may open either.
      earlier.hasOverlap = true;
      later.hasOverlap = true;
      const note = `Overlaps with ${later.name}.`;
      const earlierMessages = messages.get(earlier.slug) ?? [];
      if (!earlierMessages.includes(note)) {
        messages.set(earlier.slug, [...earlierMessages, note]);
      }
    }
  }

  for (const item of planned) item.clashes = messages.get(item.slug) ?? [];
}

export function buildCalendarItems(params: {
  shortlist: Shortlist;
  planEntries: SeasonPlanEntry[];
  suggestions: RecommendationItem[];
  /** Also draw every other event the child can enter, quietly, behind the plan and suggestions. */
  showAvailable: boolean;
  /** An event the parent has open is always drawn, whatever the toggle says. */
  selectedSlug?: string | null | undefined;
}): CalendarItem[] {
  const { shortlist, planEntries, suggestions, showAvailable, selectedSlug } = params;

  const verdicts = new Map<string, PlannerEntry>([
    ...bySlug(shortlist.ownGroup),
    ...bySlug(shortlist.playingUp),
    ...bySlug(shortlist.unknown),
    ...bySlug(shortlist.closed),
  ]);
  const planned = new Set(planEntries.map((entry) => entry.editionSlug));
  const reasons = new Map(suggestions.map((item) => [item.slug, item]));

  const items: CalendarItem[] = [];

  for (const entry of planEntries) {
    const verdict = verdicts.get(entry.editionSlug);
    const live = verdict?.edition;
    items.push({
      slug: entry.editionSlug,
      name: entry.name,
      startDate: live?.startDate ?? new Date(entry.startDate).toISOString(),
      endDate: live?.endDate,
      kind: "planned",
      status: entry.status,
      edition: live ?? {
        slug: entry.editionSlug,
        name: entry.name,
        startDate: new Date(entry.startDate).toISOString(),
      },
      verdict,
      planEntry: entry,
      clashes: [],
      hasOverlap: false,
    });
  }

  // Only events the rules allow can be suggested or available; both come from the
  // child's own age group, which is also all the suggestions are drawn from.
  for (const verdict of shortlist.ownGroup) {
    const slug = verdict.edition.slug;
    if (!slug || planned.has(slug)) continue;

    const suggestion = reasons.get(slug);
    const wanted = suggestion !== undefined || showAvailable || slug === selectedSlug;
    if (!wanted) continue;

    items.push({
      slug,
      name: verdict.edition.name,
      startDate: verdict.edition.startDate,
      endDate: verdict.edition.endDate,
      kind: suggestion ? "suggested" : "available",
      tier: suggestion?.tier,
      reason: suggestion?.reason,
      edition: verdict.edition,
      verdict,
      clashes: [],
      hasOverlap: false,
    });
  }

  markClashes(items);
  return items.sort(byStart);
}
