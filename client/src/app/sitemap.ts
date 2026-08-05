import type { MetadataRoute } from "next";

import { RESOURCE_SPORTS } from "@/modules/resources/config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";
const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * Slug-bearing records from the pathways API. Both list endpoints return the
 * full set unpaginated (5 federations, ~43 curated tournaments at time of
 * writing), so a single sitemap is enough — Google's limit is 50,000 URLs.
 * If either set grows past a few thousand, split with `generateSitemaps()`.
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

  const [federations, tournaments] = await Promise.all([
    fetchSlugs("/federations"),
    fetchSlugs("/pathways/tournaments"),
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

  // ── Tournament detail pages (/tournaments/[slug]) ──
  // Only the flat /tournaments/[slug] form is listed. The nested
  // /federations/[slug]/[tournamentSlug] route renders the same record from
  // the same endpoint but self-canonicalizes, so enumerating it here would
  // feed Google a second copy of every tournament page. See the note in the
  // handover for the underlying duplicate-content issue.
  const tournamentEntries: MetadataRoute.Sitemap = tournaments
    .filter((t): t is SlugRecord & { slug: string } => Boolean(t.slug))
    .map((t) => ({
      url: `${siteUrl}/tournaments/${t.slug}`,
      lastModified: lastMod(t),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }));

  return [
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
    ...tournamentEntries,
  ];
}
