// ─── Resource page config ───────────────────────────────────────────────────
//
// The sports that have a resource page, and the slug ↔ name mapping the route
// uses. This list exists so the sitemap and the route agree on what's publishable
// — the sport chips on the roadmap page were the only prior source of truth and
// they're inlined in a 2,000-line component.

export interface ResourceSport {
  slug: string;
  name: string;
}

/**
 * Published in this order. The three with hand-authored pathway graphs come
 * first, since their content is researched rather than derived.
 */
export const RESOURCE_SPORTS: ResourceSport[] = [
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

/**
 * State used when the reader hasn't chosen one.
 *
 * `GET /pathways` refuses a request without a valid state, so the canonical page
 * has to name one. Delhi because it is the most-cached pair in the pathway
 * collection and the most-searched metro — but it IS an arbitrary choice, and the
 * page says so wherever content is state-scoped rather than pretending the
 * default is national. That caveat disappears once `SportBasePath` is populated
 * and the base content genuinely has no state.
 */
export const DEFAULT_RESOURCE_STATE = "Delhi";

export function sportFromSlug(slug: string): ResourceSport | undefined {
  const wanted = slug.trim().toLowerCase();
  return RESOURCE_SPORTS.find((s) => s.slug === wanted);
}

/**
 * Whether this sport has a resource page at all.
 *
 * `resourceHref` slugifies whatever it is given, so without this a link would be
 * generated for every sport and half of them would 404. Callers that render a
 * link — rather than following one the user asked for — must check first.
 */
export function hasResourcePage(sportName: string): boolean {
  const wanted = sportName.trim().toLowerCase();
  return RESOURCE_SPORTS.some(
    (s) => s.name.toLowerCase() === wanted || s.slug === wanted.replace(/\s+/g, "-"),
  );
}

export function resourceHref(sportName: string, anchor?: string): string {
  const slug =
    RESOURCE_SPORTS.find(
      (s) => s.name.toLowerCase() === sportName.trim().toLowerCase(),
    )?.slug ??
    sportName.trim().toLowerCase().replace(/\s+/g, "-");
  return anchor ? `/resources/${slug}#${anchor}` : `/resources/${slug}`;
}

/**
 * Anchor for a stage, derived from its raw pathway level (1–5).
 *
 * Keyed on the raw level rather than the label because the label is per-sport
 * and per-archetype ("AITA Championship Series" vs "State Age-Group") while the
 * level is stable — which is what lets a map node deep-link here at all.
 */
export function stageAnchor(rawLevel: number): string {
  return `stage-${rawLevel}`;
}
