/**
 * The twelve AITA ranking lists, and the mapping between their API vocabulary
 * and our URLs.
 *
 * AITA's own spelling ("Boys", "U-14", "Seniorwomen") is what the API expects,
 * so it is kept verbatim here rather than prettified — the display strings are
 * derived, never the other way round. Slugs are lowercased so
 * `/rankings/boys/u-14` reads the way a parent would type it.
 */

export interface RankingCombo {
  category: string;
  subcategory: string;
}

export const LIVE_COMBOS: readonly RankingCombo[] = [
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

export const comboSlug = (combo: RankingCombo) => ({
  category: combo.category.toLowerCase(),
  subcategory: combo.subcategory.toLowerCase(),
});

export const comboHref = (combo: RankingCombo) =>
  `/rankings/${combo.category.toLowerCase()}/${combo.subcategory.toLowerCase()}`;

/**
 * Resolves a URL pair back to the exact strings the API expects. Returns null
 * for anything not on the list, so an invented URL 404s instead of reaching the
 * API and coming back empty — an empty ranking table looks like a bug, a 404
 * does not.
 */
export function resolveCombo(
  categorySlug: string,
  subcategorySlug: string,
): RankingCombo | null {
  const category = decodeURIComponent(categorySlug).toLowerCase();
  const subcategory = decodeURIComponent(subcategorySlug).toLowerCase();
  return (
    LIVE_COMBOS.find(
      (c) =>
        c.category.toLowerCase() === category &&
        c.subcategory.toLowerCase() === subcategory,
    ) ?? null
  );
}

/** "Boys U-14" -> "Boys Under-14"; "Men Singles" -> "Men's Singles". */
export function comboLabel(combo: RankingCombo): string {
  if (/^U-\d+$/i.test(combo.subcategory)) {
    return `${combo.category} Under-${combo.subcategory.replace(/^U-/i, "")}`;
  }
  const possessive = combo.category === "Men" ? "Men's" : combo.category === "Women" ? "Women's" : combo.category;
  return `${possessive} ${combo.subcategory}`;
}

/** Groups for the hub page — juniors read as an age ladder, seniors as a pair. */
export const COMBO_GROUPS: ReadonlyArray<{
  title: string;
  blurb: string;
  combos: readonly RankingCombo[];
}> = [
  {
    title: "Boys",
    blurb: "Junior age brackets, by birth year.",
    combos: LIVE_COMBOS.filter((c) => c.category === "Boys"),
  },
  {
    title: "Girls",
    blurb: "Junior age brackets, by birth year.",
    combos: LIVE_COMBOS.filter((c) => c.category === "Girls"),
  },
  {
    title: "Men",
    blurb: "Open age, singles and doubles.",
    combos: LIVE_COMBOS.filter((c) => c.category === "Men"),
  },
  {
    title: "Women",
    blurb: "Open age, singles and doubles.",
    combos: LIVE_COMBOS.filter((c) => c.category === "Women"),
  },
];

export const PAGE_SIZE = 50;
