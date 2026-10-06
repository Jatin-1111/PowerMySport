import { STATUS_LABEL } from "@/modules/planner/services/seasonPlan";
import type { CalendarItem } from "@/modules/planner/utils/calendarItems";
import { formatEventWindow } from "@/modules/planner/utils/eventFormat";

/**
 * What an event on the calendar is called aloud: its name, its dates, and the state
 * it is in. Shared by the week grid and the list so the two say the same thing.
 */
export function itemLabel(item: CalendarItem): string {
  const when = formatEventWindow(item.startDate, item.endDate);
  const state =
    item.kind === "planned"
      ? `on the plan, ${STATUS_LABEL[item.status ?? "shortlisted"].toLowerCase()}`
      : item.kind === "suggested"
        ? item.tier === "consider"
          ? "worth considering"
          : "suggested"
        : "open to enter";
  return `${item.name}, ${when}, ${state}${item.hasOverlap ? ", overlaps another planned event" : ""}`;
}

/** AITA's ladder rungs in the words a parent says. */
const LEVEL_WORD: Record<string, string> = {
  "Talent Series": "Talent",
  "Championship Series": "Championship",
  "Super Series": "Super",
  "National Series": "National",
  Nationals: "Nationals",
};

/**
 * What an event is called on the calendar itself, where there is room for a few words.
 *
 * The federation's names ("AITA CS7 (Sonipat)") are the same code fifteen times in a
 * month, and a parent tells events apart by where they are. So the place leads and the
 * level follows in plain words, in a lighter weight: "Sonipat  Championship". The full
 * name stays on the bar's title and in its accessible name.
 */
export function shortEventLabel(item: CalendarItem): { place: string; level: string | null } {
  const { edition } = item;
  const place = edition.city || edition.state || item.name;
  // The part of the name before "(City)": "ITF Juniors", "Asian Under 14".
  const stem = item.name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const level = (edition.ladder && LEVEL_WORD[edition.ladder]) || (stem !== place ? stem : null);
  return { place, level: level || null };
}
