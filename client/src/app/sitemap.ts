import type { MetadataRoute } from "next";

import { SITE_URL as siteUrl } from "@/lib/seo";
import {
  RANKING_SPORTS,
  comboHref,
  rankingSportHref,
} from "@/modules/rankings/config/rankings";
import { PATHWAY_SPORTS } from "@/modules/pathway/data/sports";

const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/**
 * Feature flags gate whole sections of the site. A sitemap that lists `/shop`
 * while `NEXT_PUBLIC_SHOP_IS_LIVE=false` is asking Google to crawl a waitlist
 * page and index it as a store — so each flagged section is included only when
 * it is actually serving its real content.
 */
const SHOP_IS_LIVE = process.env.NEXT_PUBLIC_SHOP_IS_LIVE !== "false";
const EXPERTS_IS_LIVE = process.env.NEXT_PUBLIC_EXPERTS_IS_LIVE === "true";

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

/** Minimal shapes for the two id-keyed lists below. */
interface IdRecord {
  id?: string;
  _id?: string;
  updatedAt?: string;
}

/**
 * The shop and expert list endpoints answer with different envelopes from the
 * pathways API (`{ ok, data }` vs `{ success, data }`) and nest their arrays,
 * so they get their own reader. Like `fetchSlugs` it never throws.
 *
 * Deliberately a raw `fetch` rather than `listProducts()` from
 * `lib/shop/ecommerce-api`: that helper falls back to a hardcoded demo catalogue
 * when the backend is unreachable, which would publish invented product URLs
 * into the sitemap on any API blip.
 */
async function fetchIds(
  path: string,
  pick: (body: unknown) => IdRecord[],
): Promise<IdRecord[]> {
  try {
    const res = await fetch(`${apiBase}${path}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return pick(await res.json()) ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [federations, editions, products, experts] = await Promise.all([
    fetchSlugs("/federations"),
    fetchSlugs("/tournament-editions"),
    SHOP_IS_LIVE
      ? fetchIds("/v1/products?page=1&limit=500", (body) => {
          const data = (body as { ok?: boolean; data?: { products?: IdRecord[] } })
            ?.data;
          return Array.isArray(data?.products) ? data.products : [];
        })
      : Promise.resolve([]),
    EXPERTS_IS_LIVE
      ? fetchIds("/experts?limit=200", (body) => {
          const envelope = body as {
            success?: boolean;
            data?: IdRecord[] | { experts?: IdRecord[] };
          };
          if (!envelope?.success) return [];
          if (Array.isArray(envelope.data)) return envelope.data;
          return Array.isArray(envelope.data?.experts)
            ? envelope.data.experts
            : [];
        })
      : Promise.resolve([]),
  ]);

  const lastMod = (record: SlugRecord) =>
    record.updatedAt ? new Date(record.updatedAt) : now;

  // ── Federation detail pages (/federations/[slug]) ──
  // Deep, long-tail content — eligibility rules and official calendars parents
  // search for by name. Linked from the /federations index and from each
  // sport's pathway band, so these now have real internal discovery paths too.
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

  // ── Ranking pages (/rankings/[sport] and its lists) ──
  // A hub per mirrored sport, plus that sport's fixed lists, refreshed weekly
  // from the federation. Filtered and paginated
  // views are deliberately absent: they all canonicalise to these twelve, and
  // listing `?state=` permutations would submit hundreds of near-duplicates.
  //
  // Per-player pages are absent on purpose too — they are noindex, because most
  // of the people on these lists are children. See the note in
  // app/(marketing)/rankings/players/[regNo]/page.tsx.
  // ── Shop (/shop and /shop/products/[id]) ──
  // Gated on the live flag: while the shop is off, `/shop` renders a waitlist
  // and there is nothing to list. Private shop routes (cart, orders, account,
  // checkout) are noindex and never appear here.
  const shopEntries: MetadataRoute.Sitemap = SHOP_IS_LIVE
    ? [
        {
          url: `${siteUrl}/shop`,
          lastModified: now,
          changeFrequency: "daily" as const,
          priority: 0.7,
        },
        ...products
          .map((product) => product.id ?? product._id)
          .filter((id): id is string => Boolean(id))
          .map((id) => ({
            url: `${siteUrl}/shop/products/${id}`,
            lastModified: now,
            changeFrequency: "weekly" as const,
            priority: 0.5,
          })),
      ]
    : [];

  // ── Expert profiles (/experts/[expertId]) ──
  // Expert profiles are the only indexable expert URLs — the directory itself is
  // gone (see the omission note below) — and they only make sense once experts
  // are live and bookable.
  const expertEntries: MetadataRoute.Sitemap = experts
    .map((expert) => expert.id ?? expert._id)
    .filter((id): id is string => Boolean(id))
    .map((id) => ({
      url: `${siteUrl}/experts/${id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  const rankingEntries: MetadataRoute.Sitemap = RANKING_SPORTS.flatMap(
    (sport) => [
      {
        url: `${siteUrl}${rankingSportHref(sport.slug)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      ...sport.combos.map((combo) => ({
        url: `${siteUrl}${comboHref(sport.slug, combo)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ],
  );

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
      url: `${siteUrl}/federations`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
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

    // ── Auth ──
    // Only /login, and only because "<brand> login" is a query real returning
    // users type — see the note in (auth)/login/layout.tsx. Its siblings
    // (/register, /forgot-password, /reset-password) stay noindex and stay out.
    {
      url: `${siteUrl}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // ── No booking surfaces listed, deliberately ──
    // /venues, /coaches, /academies and /experts were standalone listings; they
    // are gone and now 308 to /booking. /booking does NOT go here in their
    // place: it is `noindex` and disallowed in robots.txt (see robots.ts), so
    // submitting it would just trade three crawlable URLs for one Search
    // Console "blocked by robots.txt" error.
    {
      url: `${siteUrl}/community-waitlist`,
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
      url: `${siteUrl}/partner-terms`,
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

    // ── Sport pathways (/roadmap/[sport]) ──
    // The deepest evergreen content on the site: every stage of a sport, with
    // the questions, signals, decisions and next steps a parent faces there.
    // Listed from the static sport config rather than the API so a sitemap
    // build never depends on the API being up.
    ...PATHWAY_SPORTS.map((sport) => ({
      url: `${siteUrl}/roadmap/${sport.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),

    // ── Dynamic pathway content ──
    ...federationEntries,
    ...editionEntries,

    // ── Commerce and expert profiles ──
    ...shopEntries,
    ...expertEntries,
  ];
}
