import type { MetadataRoute } from "next";
import { COMMUNITY_BASE_URL, communityUrl, fetchPublicData } from "@/lib/seo";

interface ListItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  author?: { username?: string };
}
interface ListResponse {
  items?: ListItem[];
  pagination?: { totalPages?: number; total?: number };
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

/**
 * Google's per-sitemap ceiling is 50,000 URLs; these pages are counted in the
 * hundreds. The cap exists to bound how many API round-trips a sitemap
 * regeneration costs, not because of any protocol limit — if either collection
 * ever approaches it, split with `generateSitemaps()` rather than raising it.
 */
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

/**
 * Walk a paginated public list endpoint. The previous version asked for
 * `limit=200` once and silently truncated everything past the 200th blog, which
 * reads as "the site has 200 posts" rather than "the sitemap gave up".
 */
async function fetchAllItems(basePath: string): Promise<ListItem[]> {
  const first = await fetchPublicData<ListResponse>(
    `${basePath}?page=1&limit=${PAGE_SIZE}`,
  );
  if (!first?.items?.length) return [];

  const totalPages = Math.min(first.pagination?.totalPages ?? 1, MAX_PAGES);
  if (totalPages <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      fetchPublicData<ListResponse>(
        `${basePath}?page=${i + 2}&limit=${PAGE_SIZE}`,
      ),
    ),
  );

  return [...first.items, ...rest.flatMap((page) => page?.items ?? [])];
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // When the community is switched off, `proxy.ts` rewrites every path to `/`
  // and renders the waitlist. Listing /blog, /q and every post would then
  // submit hundreds of URLs that all serve the same waitlist page — textbook
  // duplicate content, and a self-inflicted one.
  if (process.env.NEXT_PUBLIC_COMMUNITY_IS_LIVE === "false") {
    return [
      {
        url: COMMUNITY_BASE_URL,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      },
    ];
  }

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: communityUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Best-effort inclusion of published blog posts and Q&A threads. Any failure
  // falls back to the static routes above.
  const [blogs, posts] = await Promise.all([
    fetchAllItems("/community/blog/posts"),
    fetchAllItems("/community/posts"),
  ]);

  for (const blog of blogs) {
    entries.push({
      url: `${COMMUNITY_BASE_URL}/blog/${blog.id}`,
      lastModified: toDate(blog.updatedAt || blog.createdAt),
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const post of posts) {
    entries.push({
      url: `${COMMUNITY_BASE_URL}/q/${post.id}`,
      lastModified: toDate(post.updatedAt || post.createdAt),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  // ── Writer profiles (/blog/writer/[identifier]) ──
  // These are indexable and carry ProfilePage + Person schema, but were absent
  // from the sitemap entirely — the only indexable route that was. There is no
  // author-list endpoint, so the set is derived from the authors who actually
  // have published posts, which is the same set that has anything to show.
  const writerUsernames = new Set(
    blogs
      .map((blog) => blog.author?.username)
      .filter((username): username is string => Boolean(username)),
  );

  for (const username of writerUsernames) {
    entries.push({
      url: `${COMMUNITY_BASE_URL}/blog/writer/${encodeURIComponent(username)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  return entries;
}
