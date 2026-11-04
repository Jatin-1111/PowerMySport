import type { MetadataRoute } from "next";

import { buildSitemapEntries } from "@/modules/marketing/services/sitemapEntries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries();
}
