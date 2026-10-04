// ─── Server-side reads for /admissions and /scholarships ────────────────────
//
// Plain `fetch` in Server Components, tagged `opportunities` so an admin
// publishing, editing or verifying an entry purges the cache at once
// (ClientCacheRevalidationService.ts). The hour-long window is only the
// fallback for a purge that did not arrive.

export const OPPORTUNITIES_REVALIDATE_SECONDS = 3600;

const apiBase = () => process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export type OpportunityTrack = "admission" | "scholarship";
export type CycleState = "open" | "upcoming" | "closed" | "rolling";
export type SelectionMode = "apply" | "trials" | "nominated" | "scouted" | "recruitment";

export interface Opportunity {
  slug: string;
  track: OpportunityTrack;
  category: string;
  title: string;
  summary?: string;
  owner?: { name: string; type: string };
  sports: string[];
  allSports: boolean;
  geography?: { scope: string; state?: string };
  eligibility?: {
    ageMin?: number;
    ageMax?: number;
    ageNote?: string;
    gender?: string;
    level?: string;
    academic?: string;
    income?: string;
  };
  selection?: SelectionMode;
  benefit?: {
    summary: string;
    amount?: { value: number; currency: "INR" | "USD"; period: string; note?: string };
  };
  cycle?: {
    label?: string;
    opensOn?: string;
    closesOn?: string;
    keyDates?: Array<{ label: string; date: string }>;
  };
  steps?: string[];
  keyFacts?: string[];
  applyUrl?: string;
  sources?: Array<{ label: string; url: string; publishedOn?: string }>;
  lastVerifiedOn?: string;
  verificationNote?: string;
  /** Worked out by the server on each read, never stored. */
  cycleState: CycleState;
  stale: boolean;
}

export interface OpportunityList {
  items: Opportunity[];
  /** India's date, which every window in `items` was worked out against ("2026-10-03"). */
  today: string;
  /** Sport-specific slugs present in this track, for deciding whether to offer a filter. */
  sports: string[];
  categories: string[];
}

export async function fetchOpportunities(
  track: OpportunityTrack,
  sport?: string
): Promise<OpportunityList | null> {
  const qs = new URLSearchParams({ track });
  if (sport) qs.set("sport", sport);
  try {
    const res = await fetch(`${apiBase()}/opportunities?${qs.toString()}`, {
      next: { revalidate: OPPORTUNITIES_REVALIDATE_SECONDS, tags: ["opportunities"] },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as OpportunityList) : null;
  } catch {
    return null;
  }
}

export async function fetchOpportunity(slug: string): Promise<Opportunity | null> {
  try {
    const res = await fetch(`${apiBase()}/opportunities/${encodeURIComponent(slug)}`, {
      next: { revalidate: OPPORTUNITIES_REVALIDATE_SECONDS, tags: ["opportunities"] },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.success ? (body.data as Opportunity) : null;
  } catch {
    return null;
  }
}
