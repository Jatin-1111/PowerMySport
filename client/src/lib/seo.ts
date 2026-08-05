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
