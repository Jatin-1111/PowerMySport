import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/services",
          "/how-it-works",
          "/faq",
          "/contact",
          "/coaches",
          "/venues",
          "/academies",
          // Community app paths
          "/community",
          "/community/blog",
          "/community/q",
          "/community/discover",
          "/community/ai-guidance",
        ],
        disallow: [
          "/dashboard/",
          "/coach/",
          "/venue-lister/",
          "/settings",
          "/payment",
          "/onboarding",
          "/login",
          "/register",
          // Community app paths
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
    sitemap: [
      `${siteUrl}/sitemap.xml`,
      `${siteUrl}/community/sitemap.xml`
    ],
    host: siteUrl,
  };
}
