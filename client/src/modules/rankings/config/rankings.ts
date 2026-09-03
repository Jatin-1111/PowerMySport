// ─── Ranking lists, per sport ───────────────────────────────────────────────
//
// The surface is sport-shaped even though only tennis has data. That is
// deliberate: `RankingEntry` and `RankingSnapshot` already carry `sportSlug` and
// `federationCode`, so the storage was never tennis-only — the URLs and the copy
// were, and a second federation would have meant migrating indexed pages.
//
// Adding a sport here means adding an entry to RANKING_SPORTS with its own
// category vocabulary. Categories differ wildly between sports (tennis runs
// Boys/Girls/Men/Women, chess runs Open/Women by rating band), so they belong to
// the sport rather than living in one shared list.
//
// A sport with no entry here is not a 404 — it renders as "not published",
// because "we don't mirror that yet" is a different and more honest answer than
// "that sport does not exist".

export interface RankingCombo {
  category: string;
  subcategory: string;
}

export interface ComboGroup {
  title: string;
  blurb: string;
  combos: readonly RankingCombo[];
}

export interface RankingSport {
  slug: string;
  name: string;
  /** Whose lists these are. We are mirroring, and the page has to say so. */
  federation: { name: string; acronym: string; officialUrl: string };
  /**
   * The federation's own spelling — "Boys", "U-14", "Seniorwomen" — because it
   * is what the API expects. Display strings are derived, never the reverse.
   */
  combos: readonly RankingCombo[];
  /** How the lists are grouped on the sport page. */
  groups: readonly ComboGroup[];
}

const TENNIS_COMBOS: readonly RankingCombo[] = [
  { category: "Boys", subcategory: "U-12" },
  { category: "Boys", subcategory: "U-14" },
  { category: "Boys", subcategory: "U-16" },
  { category: "Boys", subcategory: "U-18" },
  { category: "Girls", subcategory: "U-12" },
  { category: "Girls", subcategory: "U-14" },
  { category: "Girls", subcategory: "U-16" },
  { category: "Girls", subcategory: "U-18" },
  { category: "Men", subcategory: "Singles" },
  { category: "Men", subcategory: "Doubles" },
  { category: "Women", subcategory: "Singles" },
  { category: "Women", subcategory: "Doubles" },
] as const;

const byCategory = (category: string) => TENNIS_COMBOS.filter((c) => c.category === category);

const TENNIS: RankingSport = {
  slug: "tennis",
  name: "Tennis",
  federation: {
    name: "All India Tennis Association",
    acronym: "AITA",
    // AITA's ranking index on the hitcourt.com platform they moved to in
    // August 2026. The old aitatennis.com paths all 404 now.
    officialUrl: "https://www.aita.hitcourt.com/ranking",
  },
  combos: TENNIS_COMBOS,
  groups: [
    { title: "Boys", blurb: "Junior age brackets, by birth year.", combos: byCategory("Boys") },
    { title: "Girls", blurb: "Junior age brackets, by birth year.", combos: byCategory("Girls") },
    { title: "Men", blurb: "Open age, singles and doubles.", combos: byCategory("Men") },
    { title: "Women", blurb: "Open age, singles and doubles.", combos: byCategory("Women") },
  ],
};

/** Sports whose lists we actually mirror. Tennis is the only one today. */
export const RANKING_SPORTS: readonly RankingSport[] = [TENNIS];

export function getRankingSport(slug: string | undefined): RankingSport | null {
  if (!slug) return null;
  const wanted = decodeURIComponent(slug).toLowerCase();
  return RANKING_SPORTS.find((s) => s.slug === wanted) ?? null;
}

export const rankingSportHref = (sportSlug: string) => `/rankings/${sportSlug}`;

export const comboHref = (sportSlug: string, combo: RankingCombo) =>
  `/rankings/${sportSlug}/${combo.category.toLowerCase()}/${combo.subcategory.toLowerCase()}`;

export const playerHref = (sportSlug: string, regNo: string) =>
  `/rankings/${sportSlug}/players/${encodeURIComponent(regNo)}`;

/**
 * Resolves a URL pair back to the exact strings the API expects. Returns null
 * for anything not on the sport's list, so an invented URL 404s instead of
 * reaching the API and coming back empty — an empty ranking table looks like a
 * bug, a 404 does not.
 */
export function resolveCombo(
  sport: RankingSport,
  categorySlug: string,
  subcategorySlug: string
): RankingCombo | null {
  const category = decodeURIComponent(categorySlug).toLowerCase();
  const subcategory = decodeURIComponent(subcategorySlug).toLowerCase();
  return (
    sport.combos.find(
      (c) => c.category.toLowerCase() === category && c.subcategory.toLowerCase() === subcategory
    ) ?? null
  );
}

/** "Boys U-14" -> "Boys Under-14"; "Men Singles" -> "Men's Singles". */
export function comboLabel(combo: RankingCombo): string {
  if (/^U-\d+$/i.test(combo.subcategory)) {
    return `${combo.category} Under-${combo.subcategory.replace(/^U-/i, "")}`;
  }
  const possessive =
    combo.category === "Men" ? "Men's" : combo.category === "Women" ? "Women's" : combo.category;
  return `${possessive} ${combo.subcategory}`;
}

export const PAGE_SIZE = 50;
