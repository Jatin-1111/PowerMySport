import type { MetadataRoute } from "next";

import { LIVE_COMBOS, comboHref } from "@/modules/rankings/config";
import { RESOURCE_SPORTS } from "@/modules/resources/config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";
const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * Slug-bearing records from the pathways API. The federations endpoint returns
 * the full set unpaginated (5 at time of writing), so a single sitemap is enough
 * — Google's limit is 50,000 URLs. If it grows past a few thousand, split with
 * `generateSitemaps()`.
 */
interface SlugRecord {
  slug?: string;
  updatedAt?: string;
}

/**
 * Fetches a list endpoint for sitemap entries. Never throws: a sitemap that
 * fails the build is worse than one missing its dynamic half, so an API
 * outage at build time degrades to the static routes only.
 */
async function fetchSlugs(path: string): Promise<SlugRecord[]> {
  try {
    const res = await fetch(`${apiBase}${path}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.success && Array.isArray(body.data)
      ? (body.data as SlugRecord[])
      : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [federations, editions] = await Promise.all([
    fetchSlugs("/federations"),
    fetchSlugs("/tournament-editions"),
  ]);

  const lastMod = (record: SlugRecord) =>
    record.updatedAt ? new Date(record.updatedAt) : now;

  // ── Federation detail pages (/federations/[slug]) ──
  // Deep, long-tail content — eligibility rules and official calendars parents
  // search for by name. No /federations index page exists, so the sitemap is
  // currently the only discovery path Google has for these.
  const federationEntries: MetadataRoute.Sitemap = federations
    .filter((f): f is SlugRecord & { slug: string } => Boolean(f.slug))
    .map((f) => ({
      url: `${siteUrl}/federations/${f.slug}`,
      lastModified: lastMod(f),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // ── Tournament edition pages (/tournaments/[slug]) ──
  // One dated event each — "AITA CS7 (Delhi), 10 Aug 2026" — which is the form
  // parents actually search. Deliberately a single canonical route: the earlier
  // pair of tournament routes was deleted precisely because two of them
  // rendered the same record and fed Google duplicates.
  //
  // The endpoint only returns editions that still lie ahead, so finished events
  // drop out of the sitemap on their own rather than accumulating dead URLs.
  const editionEntries: MetadataRoute.Sitemap = editions
    .filter((e): e is SlugRecord & { slug: string } => Boolean(e.slug))
    .map((e) => ({
      url: `${siteUrl}/tournaments/${e.slug}`,
      lastModified: lastMod(e),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // ── Ranking list pages (/rankings/[category]/[subcategory]) ──
  // Twelve fixed lists, refreshed weekly from AITA. Filtered and paginated
  // views are deliberately absent: they all canonicalise to these twelve, and
  // listing `?state=` permutations would submit hundreds of near-duplicates.
  //
  // Per-player pages are absent on purpose too — they are noindex, because most
  // of the people on these lists are children. See the note in
  // app/(marketing)/rankings/players/[regNo]/page.tsx.
  const rankingEntries: MetadataRoute.Sitemap = LIVE_COMBOS.map((combo) => ({
    url: `${siteUrl}${comboHref(combo)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: `${siteUrl}/rankings`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...rankingEntries,
    // ── Core product pages (highest priority — live and valuable) ──
    {
      url: `${siteUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/roadmap`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.98,
    },
    {
      url: `${siteUrl}/assessment`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.97,
    },
    {
      url: `${siteUrl}/assessment/discover`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${siteUrl}/sport-profile`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${siteUrl}/guidance`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${siteUrl}/experts`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },

    // ── Marketing / informational ──
    {
      url: `${siteUrl}/how-it-works`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${siteUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/careers`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // ── Booking surfaces (waitlist pages while booking is paused) ──
    // Listed so Google re-crawls them and replaces the cached 404 with a 200.
    {
      url: `${siteUrl}/venues`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/coaches`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },

    // ── Legal ── (low priority, don't waste crawl budget) ──
    {
      url: `${siteUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/refund-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/cookies`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/content-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/health-waiver`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${siteUrl}/parental-consent`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },

    // ── Sport resource guides (/resources/[sport]) ──
    // The deepest evergreen content on the site: every stage of a sport with
    // ages, costs, funding schemes and coach guidance. Listed from a static
    // config rather than the API because these are pre-rendered at build.
    //
    // Only the bare path is listed. The `?state=` variants canonicalise back to
    // it, so putting them here would ask Google to index several hundred pages
    // that differ by one list of academies.
    ...RESOURCE_SPORTS.map((sport) => ({
      url: `${siteUrl}/resources/${sport.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),

    // ── Dynamic pathway content ──
    ...federationEntries,
    ...editionEntries,
  ];
}
