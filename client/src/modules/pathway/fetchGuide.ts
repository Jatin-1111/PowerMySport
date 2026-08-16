import type {
  PathwayGuide,
  PathwayGuideSummary,
} from "@/modules/sports/services/pathway";

// ─── Server-side pathway fetch ───────────────────────────────────────────────
//
// Fetched here rather than through `pathwayApi`, which is built on the browser
// axios instance. The pathway's whole job is to be readable and indexable
// without JavaScript, so the content has to be in the HTML the server sends.
//
// Nothing behind these endpoints generates anything — they read published
// documents — so a plain ISR cache is the right shape and a cold page is fast.

const REVALIDATE_SECONDS = 3600;

const apiBase = (): string =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function fetchPathwayGuide(
  sport: string,
  state?: string,
): Promise<PathwayGuide | null> {
  const params = new URLSearchParams({ sport });
  if (state?.trim()) params.set("state", state.trim());
  try {
    const res = await fetch(`${apiBase()}/pathways/guide?${params.toString()}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    // 404 is the normal answer for a sport whose pathway isn't published yet.
    if (!res.ok) return null;
    const body = await res.json();
    return body?.success && body?.data ? (body.data as PathwayGuide) : null;
  } catch {
    return null;
  }
}

/**
 * A short cache, deliberately — one minute, not the hour a stage body gets.
 *
 * This list is prerendered at build time, when the API is usually unreachable,
 * so a fresh deploy bakes in "no pathways published yet". It is also the list
 * that changes the moment an admin presses Publish. An hour of either is too
 * long for the page that decides whether a sport is visible at all.
 */
const INDEX_REVALIDATE_SECONDS = 60;

export async function fetchPublishedPathways(): Promise<PathwayGuideSummary[]> {
  try {
    const res = await fetch(`${apiBase()}/pathways/guides`, {
      next: { revalidate: INDEX_REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body?.success && Array.isArray(body.data)
      ? (body.data as PathwayGuideSummary[])
      : [];
  } catch {
    return [];
  }
}
