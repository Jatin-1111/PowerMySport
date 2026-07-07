import type { MetadataRoute } from "next";
import { COMMUNITY_BASE_URL, communityUrl, fetchPublicData } from "@/lib/seo";

interface ListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}
interface ListResponse {
  items?: ListItem[];
}

// Public, indexable routes within the community app.
const staticRoutes: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/blog", priority: 0.9, changeFrequency: "daily" },
  { path: "/q", priority: 0.9, changeFrequency: "daily" },
  { path: "/discover", priority: 0.8, changeFrequency: "weekly" },
];

const toDate = (value?: string): Date => {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: communityUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Best-effort inclusion of published blog posts and Q&A threads. Any failure
  // falls back to the static routes above.
  const [blogs, posts] = await Promise.all([
    fetchPublicData<ListResponse>("/community/blog/posts?page=1&limit=200"),
    fetchPublicData<ListResponse>("/community/posts?page=1&limit=200"),
  ]);

  for (const blog of blogs?.items ?? []) {
    entries.push({
      url: `${COMMUNITY_BASE_URL}/blog/${blog.id}`,
      lastModified: toDate(blog.updatedAt || blog.createdAt),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const post of posts?.items ?? []) {
    entries.push({
      url: `${COMMUNITY_BASE_URL}/q/${post.id}`,
      lastModified: toDate(post.updatedAt || post.createdAt),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
