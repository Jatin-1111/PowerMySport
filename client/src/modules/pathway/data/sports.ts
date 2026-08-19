// ─── Sport registry ─────────────────────────────────────────────────────────
//
// The sports the site publishes a pathway URL for, and the slug ↔ name mapping.
// It exists so the sitemap and the route agree on what is publishable without
// either of them calling the API.
//
// Note this is the list of sports we are WILLING to publish. Whether a given
// sport actually has a pathway a parent can read is decided in the CMS, and
// `/roadmap/[sport]` answers 404 until one is published.

/**
 * The families the picker groups sports into.
 *
 * A flat list of ten sports is a list; a flat list of fifty is a wall. These are
 * the coarse buckets a parent already thinks in ("we want a racquet sport"), and
 * they are deliberately few — a filter row with fifteen options is the same wall
 * one row higher up.
 *
 * "Other" is the honest default for a sport published before anyone classified
 * it, and it keeps a missing entry here from hiding a sport from the filter.
 */
export const SPORT_GROUPS = [
  "Racquet",
  "Team",
  "Individual",
  "Combat",
  "Water",
  "Mind",
  "Other",
] as const;

export type SportGroup = (typeof SPORT_GROUPS)[number];

export interface PathwaySport {
  slug: string;
  name: string;
  group: SportGroup;
  /**
   * Other things parents type looking for this sport. Searching "ping pong"
   * should find Table Tennis; searching "footy" should find Football. Never
   * shown — this only widens what matches.
   */
  aliases?: string[];
}

/** Published in this order — the sports whose pathways are written first. */
export const PATHWAY_SPORTS: PathwaySport[] = [
  { slug: "tennis", name: "Tennis", group: "Racquet" },
  { slug: "cricket", name: "Cricket", group: "Team" },
  { slug: "chess", name: "Chess", group: "Mind" },
  { slug: "badminton", name: "Badminton", group: "Racquet", aliases: ["shuttle"] },
  { slug: "football", name: "Football", group: "Team", aliases: ["soccer", "footy"] },
  { slug: "basketball", name: "Basketball", group: "Team" },
  { slug: "hockey", name: "Hockey", group: "Team" },
  {
    slug: "table-tennis",
    name: "Table Tennis",
    group: "Racquet",
    aliases: ["ping pong", "tt"],
  },
  { slug: "swimming", name: "Swimming", group: "Water", aliases: ["swim"] },
  { slug: "volleyball", name: "Volleyball", group: "Team" },
];

const BY_SLUG = new Map(PATHWAY_SPORTS.map((sport) => [sport.slug, sport]));

/**
 * Where a sport sits in the curated order, for anything that has to choose a few
 * sports out of many — which questions to preview, which sports lead the grid.
 *
 * A sport missing from the registry sorts last rather than first: the registry
 * is a statement of priority, and absence from it is not a claim of priority.
 * Callers break the resulting tie however they already order things, which for
 * the API's list is alphabetical.
 */
export function pathwaySportRank(slug: string): number {
  const at = PATHWAY_SPORTS.findIndex((sport) => sport.slug === slug);
  return at >= 0 ? at : Number.MAX_SAFE_INTEGER;
}

/** The group a sport belongs to, defaulting to "Other" for an unlisted one. */
export function sportGroup(slug: string): SportGroup {
  return BY_SLUG.get(slug)?.group ?? "Other";
}

/** Lowercased name, slug and aliases — everything the picker's search matches. */
export function sportSearchTerms(slug: string, name: string): string[] {
  const registered = BY_SLUG.get(slug);
  return [name, slug.replace(/-/g, " "), ...(registered?.aliases ?? [])].map(
    (term) => term.toLowerCase(),
  );
}

export function sportFromSlug(slug: string): PathwaySport | undefined {
  const wanted = slug.trim().toLowerCase();
  return PATHWAY_SPORTS.find((s) => s.slug === wanted);
}

/**
 * Link to a sport's pathway from a display name ("Table Tennis" → `/roadmap/table-tennis`).
 *
 * The pathway lives at `/roadmap/[sport]`. Callers used to build `/roadmap?sport=Tennis`
 * from the old explorer, which took the sport as a query param — the index ignores
 * it, so every one of those links silently dropped the reader on the sport picker.
 *
 * Falls back to the index for a sport we don't publish, which is the picker they
 * would have landed on anyway — better than a 404 on `/roadmap/kabaddi`.
 */
export function roadmapHref(sportName: string | undefined | null): string {
  const slug = sportName?.trim().toLowerCase().replace(/\s+/g, "-");
  return slug && PATHWAY_SPORTS.some((s) => s.slug === slug)
    ? `/roadmap/${slug}`
    : "/roadmap";
}
