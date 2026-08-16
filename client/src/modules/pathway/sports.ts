// ─── Sport registry ─────────────────────────────────────────────────────────
//
// The sports the site publishes a pathway URL for, and the slug ↔ name mapping.
// It exists so the sitemap and the route agree on what is publishable without
// either of them calling the API.
//
// Note this is the list of sports we are WILLING to publish. Whether a given
// sport actually has a pathway a parent can read is decided in the CMS, and
// `/roadmap/[sport]` answers 404 until one is published.

export interface PathwaySport {
  slug: string;
  name: string;
}

/** Published in this order — the sports whose pathways are written first. */
export const PATHWAY_SPORTS: PathwaySport[] = [
  { slug: "tennis", name: "Tennis" },
  { slug: "cricket", name: "Cricket" },
  { slug: "chess", name: "Chess" },
  { slug: "badminton", name: "Badminton" },
  { slug: "football", name: "Football" },
  { slug: "basketball", name: "Basketball" },
  { slug: "hockey", name: "Hockey" },
  { slug: "table-tennis", name: "Table Tennis" },
  { slug: "swimming", name: "Swimming" },
  { slug: "volleyball", name: "Volleyball" },
];

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
