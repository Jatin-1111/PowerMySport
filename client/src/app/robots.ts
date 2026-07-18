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
          "/find-sport",
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
        disallow: [
          "/dashboard/",
          "/coach/",
          "/venue-lister/",
          "/expert/",
          "/academy/",
          "/settings",
          "/payment",
          "/checkout",
          "/onboarding",
          "/login",
          "/register",
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
