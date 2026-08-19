import type { TournamentEdition } from "@/modules/pathway/services/pathway";

// ─── Grouping calendar editions by tournament series ────────────────────────
//
// A federation calendar reads as noise because one series repeats across many
// cities: of August's 70 AITA editions, 38 are Championship Series in 23
// different places. Listed flat that's 38 near-identical rows; grouped by
// series it's one card. The whole 118-edition, four-month calendar collapses to
// about 12 series.
//
// This groups by series *identity*, which is read straight off the event name —
// it deliberately makes no claim about competitive level. District/State/National
// is a representation ladder that doesn't exist in a ranking sport (see
// sportArchetypes.ts), whereas "this is a Championship Series event" is just what
// the federation published.

interface SeriesRule {
  key: string;
  label: string;
  /** Short code shown as the card's secondary identifier. */
  code: string;
  /** Optional one-word context, e.g. flagging an international circuit. */
  note?: string;
  /** Display position — follows AITA's ladder so the cards themselves teach the progression. */
  order: number;
  test: RegExp;
}

/**
 * Match order is deliberate: international bodies are tested before the short
 * domestic codes, so "AITA ITF Juniors" is an ITF event rather than being
 * matched on an incidental letter pair. Codes are case-sensitive — they're
 * always upper-case in calendar cells and a loose match fires on ordinary words.
 *
 * Series names per the federation's own tiers: TS = Talent Series,
 * CS = Championship Series, NS = National Series, SS = Super Series.
 */
const SERIES_RULES: SeriesRule[] = [
  { key: "ITF", label: "ITF circuit", code: "ITF", note: "International", order: 70, test: /\bITF\b/ },
  { key: "ATP", label: "ATP circuit", code: "ATP", note: "Professional", order: 71, test: /\bATP\b/ },
  { key: "WTA", label: "WTA circuit", code: "WTA", note: "Professional", order: 72, test: /\bWTA\b/ },
  { key: "BWF", label: "BWF circuit", code: "BWF", note: "International", order: 73, test: /\bBWF\b/ },
  { key: "ASIAN", label: "Asian circuit", code: "Asian", note: "International", order: 74, test: /\basian\b/i },
  { key: "WORLD", label: "World events", code: "World", note: "International", order: 75, test: /\bworld\b/i },

  { key: "TS", label: "Talent Series", code: "TS", note: "Entry level", order: 10, test: /\bTS\d*\b/ },
  { key: "CS", label: "Championship Series", code: "CS", note: "Ranking tier", order: 20, test: /\bCS\d*\b/ },
  { key: "NS", label: "National Series", code: "NS", order: 30, test: /\bNS\b/ },
  { key: "SS", label: "Super Series", code: "SS", order: 40, test: /\bSS\b/ },
  { key: "NATIONALS", label: "National Championship", code: "Nationals", order: 50, test: /\bnationals?\b/i },
  { key: "PRIZE", label: "Prize money", code: "Prize", order: 60, test: /\bRs\.?\s*[\d.]+\s*lakh\b/i },
];

const FALLBACK: Omit<SeriesRule, "test"> = {
  key: "OTHER",
  label: "Other events",
  code: "Other",
  order: 999,
};

export interface SeriesGroup {
  key: string;
  label: string;
  code: string;
  note?: string | undefined;
  order: number;
  editions: TournamentEdition[];
  cities: string[];
  ageGroups: string[];
  dateCount: number;
}

function ruleFor(name: string): Omit<SeriesRule, "test"> {
  return SERIES_RULES.find((r) => r.test.test(name)) ?? FALLBACK;
}

/**
 * Prize-money events are split by amount rather than lumped together — a ₹1 lakh
 * and a ₹2.5 lakh event draw different fields, so the amount is part of the
 * series identity a player is choosing between.
 */
function prizeSuffix(name: string): string {
  const m = name.match(/\bRs\.?\s*([\d.]+)\s*lakh\b/i);
  return m?.[1] ? ` ₹${m[1]}L` : "";
}

/**
 * The part of an event name that actually differs from its siblings.
 *
 * Inside the Championship Series group every row is literally "AITA CS7 (City)",
 * so repeating the organiser and code on each line is nine-fold noise — the only
 * new information is the city. Federation calendars put that in a trailing
 * parenthetical, so prefer it; otherwise fall back to the name minus a leading
 * organiser acronym, and to the full name if that leaves nothing.
 */
export function editionShortLabel(name: string): string {
  const paren = name.match(/\(([^)]+)\)\s*$/);
  if (paren?.[1]?.trim()) return paren[1].trim();
  const stripped = name.replace(/^([A-Z]{2,6})\s+/, "").trim();
  return stripped || name;
}

export function groupEditionsBySeries(editions: TournamentEdition[]): SeriesGroup[] {
  const map = new Map<string, SeriesGroup>();

  for (const e of editions) {
    const rule = ruleFor(e.name);
    const suffix = rule.key === "PRIZE" ? prizeSuffix(e.name) : "";
    const key = rule.key + suffix;

    let group = map.get(key);
    if (!group) {
      group = {
        key,
        label: rule.label + suffix,
        code: rule.code,
        note: rule.note,
        order: rule.order,
        editions: [],
        cities: [],
        ageGroups: [],
        dateCount: 0,
      };
      map.set(key, group);
    }
    group.editions.push(e);
  }

  for (const group of map.values()) {
    group.editions.sort((a, b) => a.startDate.localeCompare(b.startDate));
    group.cities = [...new Set(group.editions.map((e) => e.city?.trim()).filter((c): c is string => !!c))];
    group.ageGroups = [...new Set(group.editions.flatMap((e) => e.ageGroups ?? []))].sort(
      (a, b) => (parseInt(a.match(/\d+/)?.[0] ?? "999", 10) - parseInt(b.match(/\d+/)?.[0] ?? "999", 10)) || a.localeCompare(b),
    );
    group.dateCount = new Set(group.editions.map((e) => e.startDate.slice(0, 10))).size;
  }

  return [...map.values()].sort(
    (a, b) => a.order - b.order || b.editions.length - a.editions.length || a.label.localeCompare(b.label),
  );
}
