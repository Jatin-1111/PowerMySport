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
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
