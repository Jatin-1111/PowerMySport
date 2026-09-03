import type { Federation } from "../../pathway/services/pathway";

// ─── Server-side federation fetch ────────────────────────────────────────────
//
// Fetched here rather than through `federationApi`, which is built on the
// browser axios instance. The federation band sits on `/roadmap/[sport]`, a page
// whose whole point is being readable and indexable without JavaScript — so who
// governs the sport has to be in the HTML the server sends, not fetched after.
//
// The list endpoint reads curated documents and generates nothing, so a plain
// ISR cache is the right shape.

const REVALIDATE_SECONDS = 3600;

/**
 * A short cache for the index, deliberately — the same trap `/roadmap` fell
 * into. `/federations` takes no dynamic params, so Next prerenders it at build
 * time, when the API is usually unreachable; an hour's revalidate would ship a
 * deploy that shows "we're curating these" on the page whose entire job is
 * listing them. Sport-scoped calls sit on dynamically rendered pages and keep
 * the full hour.
 */
export const FEDERATION_INDEX_REVALIDATE_SECONDS = 60;

/**
 * What `GET /api/federations` actually returns.
 *
 * The list route projects away the five heavy fields, so typing this as
 * `Federation` would promise callers eligibility tables and registration steps
 * that are never in the payload. Only the detail route has those.
 */
export type FederationSummary = Omit<
  Federation,
  | "stateAssociations"
  | "eligibilityCriteria"
  | "registrationSteps"
  | "requiredDocuments"
  | "sourceUrls"
>;

const apiBase = (): string => process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * Ordered so the body a parent in India has to deal with comes first.
 *
 * Tennis returns AITA alongside ITF, ATP and UTR. All four are real, but only
 * AITA decides whether a twelve-year-old can enter a tournament next month —
 * leaving the order to Mongo put an international tour body in the lead card.
 */
const TYPE_RANK: Record<FederationSummary["type"], number> = {
  govt: 0,
  national: 1,
  hybrid: 2,
};

function byGoverningRelevance(a: FederationSummary, b: FederationSummary): number {
  const rank = TYPE_RANK[a.type] - TYPE_RANK[b.type];
  return rank !== 0 ? rank : a.name.localeCompare(b.name);
}

/**
 * Every active federation, or just one sport's when `sportSlug` is given.
 *
 * Returns `[]` on any failure rather than throwing: a federation band is
 * supplementary to the pathway it sits under, and an API hiccup should drop the
 * band, never take down the stage content a parent came to read.
 */
export async function fetchFederations(
  sportSlug?: string,
  revalidateSeconds: number = REVALIDATE_SECONDS
): Promise<FederationSummary[]> {
  const query = sportSlug?.trim()
    ? `?sport=${encodeURIComponent(sportSlug.trim().toLowerCase())}`
    : "";
  try {
    const res = await fetch(`${apiBase()}/federations${query}`, {
      next: { revalidate: revalidateSeconds },
    });
    if (!res.ok) return [];
    const body = await res.json();
    if (!body?.success || !Array.isArray(body.data)) return [];
    return (body.data as FederationSummary[]).sort(byGoverningRelevance);
  } catch {
    return [];
  }
}
