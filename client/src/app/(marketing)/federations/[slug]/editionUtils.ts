import type { TournamentEdition } from "@/modules/sports/services/pathway";

// Shared by the calendar's browse-all view and the player-event finder, so a
// tournament row looks and reads the same in both.
//
// Editions are calendar dates stored as UTC midnight, so every read below uses
// UTC getters / `timeZone: "UTC"` — otherwise a viewer west of UTC sees every
// tournament shifted a day earlier. Separately: ICU returns a broken string
// (e.g. "2026 (day: 31)") when "day"+"year" are requested without "month", so
// every option bag that asks for a day must also ask for a month.
export const CAL_TZ = "UTC";

export const LEVEL_COLORS: Record<string, { pill: string; dot: string }> = {
  international: { pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  national: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  state: { pill: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  district: { pill: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  zonal: { pill: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

export function levelColor(level: string) {
  return (
    LEVEL_COLORS[level.toLowerCase()] ?? {
      pill: "bg-slate-50 text-slate-600 border-slate-200",
      dot: "bg-slate-400",
    }
  );
}

/** The approval flow writes the literal string "admin-submitted" when a calendar edition has no cited source. */
export function isLinkableSourceUrl(url: string | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

export function dateKey(date: string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function monthKeyOf(date: string): string {
  return dateKey(date).slice(0, 7);
}

export function isMultiDayEdition(e: TournamentEdition): boolean {
  return !!e.endDate && dateKey(e.endDate) !== dateKey(e.startDate);
}

export function formatShortEndDate(endDate: string, startDate: string): string {
  const end = new Date(endDate);
  const label = end.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: CAL_TZ,
  });
  return end.getUTCFullYear() === new Date(startDate).getUTCFullYear()
    ? label
    : `${label} ${end.getUTCFullYear()}`;
}

/**
 * Extracted venue/city are frequently identical, or one contains the other, or
 * venue is a placeholder — collapse those so we never render "Raipur, Raipur".
 */
export function formatLocation(venue?: string, city?: string): string | null {
  const v = venue?.trim();
  const c = city?.trim();
  if (!v) return c || null;
  if (!c) return v;
  if (/^(tbc|tba|to be (confirmed|announced))$/i.test(v)) return c;
  const vl = v.toLowerCase();
  const cl = c.toLowerCase();
  if (vl === cl || vl.includes(cl) || cl.includes(vl)) return v.length >= c.length ? v : c;
  return `${v}, ${c}`;
}

/** "Under-14" -> 14, so age-group chips sort numerically rather than alphabetically. */
export function ageGroupRank(label: string): number {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

/** Age groups offered by the data, ordered youngest-first with adult categories last. */
export function sortedAgeGroups(editions: TournamentEdition[]): string[] {
  return Array.from(new Set(editions.flatMap((e) => e.ageGroups ?? []))).sort(
    (a, b) => ageGroupRank(a) - ageGroupRank(b) || a.localeCompare(b),
  );
}

export interface EditionDateGroup {
  key: string;
  date: Date;
  editions: TournamentEdition[];
}

export interface EditionMonthBucket {
  key: string;
  shortLabel: string;
  fullLabel: string;
  editions: TournamentEdition[];
}

/** Many editions share one start date (a series running in several cities) — group them under a single date header. */
export function groupEditionsByDate(editions: TournamentEdition[]): EditionDateGroup[] {
  const groups = new Map<string, EditionDateGroup>();
  for (const e of editions) {
    const key = dateKey(e.startDate);
    let group = groups.get(key);
    if (!group) {
      group = { key, date: new Date(e.startDate), editions: [] };
      groups.set(key, group);
    }
    group.editions.push(e);
  }
  return Array.from(groups.values());
}

/** Month buckets drive the calendar's primary navigation — one pill per month with a live count. */
export function bucketEditionsByMonth(editions: TournamentEdition[]): EditionMonthBucket[] {
  const buckets = new Map<string, EditionMonthBucket>();
  for (const e of editions) {
    const key = monthKeyOf(e.startDate);
    let bucket = buckets.get(key);
    if (!bucket) {
      const d = new Date(e.startDate);
      bucket = {
        key,
        shortLabel: d.toLocaleDateString("en-IN", { month: "short", timeZone: CAL_TZ }),
        fullLabel: `${d.toLocaleDateString("en-IN", { month: "long", timeZone: CAL_TZ })} ${d.getUTCFullYear()}`,
        editions: [],
      };
      buckets.set(key, bucket);
    }
    bucket.editions.push(e);
  }
  return Array.from(buckets.values());
}
