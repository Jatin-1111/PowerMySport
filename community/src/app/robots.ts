import type { MetadataRoute } from "next";
import { COMMUNITY_BASE_URL, SITE_URL } from "@/lib/seo";

/**
 * With `basePath: "/community"`, Next.js serves this at
 * `/community/robots.txt`. Paths below are absolute (rooted at the site
 * origin) and therefore include the `/community` prefix explicitly.
 *
 * Note this file is largely belt-and-braces: in production the apex serves
 * `/community/*` through a rewrite from the `client` app, so crawlers read
 * `powermysport.com/robots.txt` — the client's — for those URLs. This one only
 * applies to `/community/robots.txt` itself and to the bare subdomain.
 *
 * There is no `disallow` list any more. It used to block `/community/chats`,
 * `/community/members/`, `/community/join/` and the rest — every one of which
 * already carries a `noindex` tag and is linked from the community's own nav.
 * Blocking a linked page means Googlebot can never fetch it to read that tag,
 * so it stays indexable URL-only and lands in the "Blocked by robots.txt"
 * report. The sibling `client` app's robots.ts documents this exact policy and
 * follows it; this file was doing the opposite.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/community",
      },
    ],
    sitemap: `${COMMUNITY_BASE_URL}/sitemap.xml`,
    // `host` takes an origin, not a path — `https://powermysport.com/community`
    // was not a valid value and would simply be ignored.
    host: SITE_URL,
  };
}
