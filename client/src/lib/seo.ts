import type { Metadata } from "next";

/**
 * Metadata for pages that must never appear in search results — auth screens,
 * onboarding funnels, and anything behind a session.
 *
 * These routes are deliberately *crawlable* (they are not in robots.ts's
 * disallow list). Google treats robots.txt as a crawl directive, not an
 * indexing one: a blocked URL that is linked from elsewhere on the site can
 * still be indexed URL-only, and it shows up in Search Console as "Blocked by
 * robots.txt". Letting Googlebot fetch the page and read `noindex` is the only
 * way to have it dropped from the index for good.
 */
export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

/**
 * BreadcrumbList structured data.
 *
 * Worth the few lines wherever a section is more than one level deep: it is how
 * Google renders the hierarchy in a result instead of a bare URL, and it tells
 * it that `/rankings/tennis/boys/u-14` sits under `/rankings/tennis` rather than
 * being a top-level page that happens to have slashes in it.
 *
 * Paths are site-relative; the absolute URL is built here so a caller can never
 * emit a hardcoded host — the wrong-host canonical was a real bug on this site
 * once and is not worth repeating.
 */
export function breadcrumbJsonLd(
  trail: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}
