import type { TournamentEdition } from "@/modules/pathway/services/pathway";

// ─── Server-side reads for the public tournaments pages ─────────────────────
//
// Plain `fetch` rather than the axios client: these run in Server Components,
// and the `tournament-editions` tag is what the server purges when an admin
// approves a calendar (ClientCacheRevalidationService.ts), so a new calendar
// shows up at once instead of when the five-minute window lapses.

export const LIST_REVALIDATE_SECONDS = 300;

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface EditionFacets {
  categories: FacetOption[];
  ages: FacetOption[];
  months: FacetOption[];
}

export interface EditionListFilters {
  category?: string | undefined;
  age?: string | undefined;
  month?: string | undefined;
}

export type ListedEdition = TournamentEdition & {
  /** "Championship Series", "ITF junior event"; null when nothing is known. */
  categoryLabel?: string | null;
};

export interface EditionsListResponse {
  editions: ListedEdition[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  facets?: EditionFacets;
  /** The filters the server actually applied; one that matched nothing is dropped. */
  applied?: EditionListFilters;
}

export interface SportFacet {
  sportSlug: string;
  total: number;
  upcoming: number;
}

export async function fetchSportEditions(
  sportSlug: string,
  options: { page: number; limit: number; upcoming: boolean; filters?: EditionListFilters }
): Promise<EditionsListResponse | null> {
  const qs = new URLSearchParams({
    sport: sportSlug,
    page: String(options.page),
    limit: String(options.limit),
    upcoming: String(options.upcoming),
  });
  for (const [key, value] of Object.entries(options.filters ?? {})) {
    if (value) qs.set(key, value);
  }

  try {
    const res = await fetch(`${apiBase()}/tournament-editions?${qs.toString()}`, {
      next: { revalidate: LIST_REVALIDATE_SECONDS, tags: ["tournament-editions"] },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as EditionsListResponse) : null;
  } catch {
    return null;
  }
}

/** How many editions each sport holds, so no page links a sport with none. */
export async function fetchSportFacets(): Promise<SportFacet[]> {
  try {
    const res = await fetch(`${apiBase()}/tournament-editions?facets=sports`, {
      next: { revalidate: LIST_REVALIDATE_SECONDS, tags: ["tournament-editions"] },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.success && Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
}
