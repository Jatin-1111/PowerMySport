import { SITE_URL as siteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";

/**
 * The apex domain's robots.txt.
 *
 * This is the one crawlers actually read for the whole site, `/community/*`
 * included — that app is served through a rewrite in `next.config.ts`, so its
 * own `/community/robots.txt` is only reachable at that path and is not
 * consulted for apex URLs.
 *
 * Policy, and it is worth stating because the two halves look contradictory:
 *
 *  - `disallow` is for deep, session-only trees nobody links to from a public
 *    page — the partner and player consoles. Blocking them saves crawl budget
 *    and there is no linked URL for Google to index name-only.
 *  - Everything else that should stay out of the index — auth screens,
 *    onboarding, carts, community member pages — is left **crawlable** and
 *    carries a `noindex` tag instead (see `NOINDEX_METADATA` in lib/seo.ts).
 *    robots.txt is a crawl directive, not an indexing one: a blocked URL that
 *    is linked from anywhere can still be indexed URL-only, and Googlebot can
 *    never read a `noindex` on a page it is not allowed to fetch. That is
 *    exactly what produced the "Blocked by robots.txt" report in Search
 *    Console.
 *
 * There is no `allow` list. `allow: "/"` made every other entry decorative, and
 * the decorative list had already drifted — it was missing /rankings,
 * /resources, /federations, /tournaments and /shop, all of which are in the
 * sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Role consoles — auth-gated, nothing public links into them.
          "/dashboard/",
          "/coach/",
          "/venue-lister/",
          "/expert/",
          "/academy/",
          "/settings",
          // Transactional funnels tied to one person's session.
          "/payment",
          "/checkout",
          "/booking",
          "/saved",
          "/notifications",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
