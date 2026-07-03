import type { MetadataRoute } from "next";
import { COMMUNITY_BASE_URL } from "@/lib/seo";

/**
 * With `basePath: "/community"`, Next.js serves this at
 * `/community/robots.txt`. Paths below are absolute (rooted at the site
 * origin) and therefore include the `/community` prefix explicitly.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/community",
          "/community/blog",
          "/community/q",
          "/community/discover",
          "/community/ai-guidance",
        ],
        disallow: [
          "/community/chats",
          "/community/notifications",
          "/community/following",
          "/community/reports",
          "/community/safety",
          "/community/privacy",
          "/community/contributors",
          "/community/members/",
          "/community/join/",
          "/community/blog/account",
          "/community/blog/write",
          "/community/blog/edit/",
        ],
      },
    ],
    sitemap: `${COMMUNITY_BASE_URL}/sitemap.xml`,
    host: COMMUNITY_BASE_URL,
  };
}
