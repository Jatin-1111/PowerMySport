import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

const staticRoutes = [
  "",
  "/about",
  "/services",
  "/how-it-works",
  "/faq",
  "/contact",
  "/careers",
  "/accessibility",
  "/privacy",
  "/terms",
  "/cookies",
  "/content-policy",
  "/refund-policy",
  "/insurance-requirements",
  "/health-waiver",
  "/parental-consent",
  "/coaches",
  "/venues",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return staticRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority:
      route === ""
        ? 1
        : route === "/coaches" || route === "/venues"
          ? 0.9
          : 0.7,
  }));
}
