import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/roadmap",
          "/assessment",
          "/sport-profile",
          "/guidance",
          "/experts",
          "/how-it-works",
          "/about",
          "/faq",
          "/contact",
          "/careers",
          "/privacy",
          "/terms",
          "/refund-policy",
          "/cookies",
          "/content-policy",
          "/community",
          "/community/blog",
          "/community/q",
          "/community/discover",
        ],
        // Only genuinely private / transactional areas belong here. Public
        // pages we simply don't want indexed (auth screens, onboarding funnels)
        // are left crawlable and carry a `noindex` tag instead — see
        // src/lib/seo.ts. Blocking those in robots.txt would stop Googlebot
        // from ever reading the tag, which is what produced the "Blocked by
        // robots.txt" report in Search Console.
        disallow: [
          "/dashboard/",
          "/coach/",
          "/venue-lister/",
          "/expert/",
          "/academy/",
          "/settings",
          "/payment",
          "/checkout",
          "/booking",
          "/saved",
          "/notifications",
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
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
