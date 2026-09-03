import { Suspense } from "react";
import BlogLandingClient from "@/modules/community/components/blog/BlogLandingClient";
import {
  breadcrumbSchema,
  itemListSchema,
  JsonLd,
} from "@/modules/community/components/seo/JsonLd";
import { buildMetadata, communityUrl, fetchPublicData, SITE_NAME } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Sports Blog — Stories, Tips & Expert Advice",
  description:
    "Read the PowerMySport community blog: coaching tips, training insights, and expert sports advice written by parents.",
  path: "/blog",
});

const blogCollectionSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: `${SITE_NAME} Blog`,
  description:
    "Coaching tips, training insights, and expert sports advice from the PowerMySport community.",
  url: communityUrl("/blog"),
};

interface BlogListRow {
  id: string;
  title: string;
}

export default async function CommunityBlogPage() {
  // The landing UI fetches client-side, so without this the index page ships no
  // evidence of what it lists. One cached page of posts is enough to tell a
  // crawler this is a real, populated collection rather than an empty shell.
  const recent = await fetchPublicData<{ items?: BlogListRow[] }>(
    "/community/blog/posts?page=1&limit=20"
  );

  return (
    <>
      <JsonLd
        data={[
          blogCollectionSchema,
          breadcrumbSchema([
            { name: "Community", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
          ...(recent?.items?.length
            ? [
                itemListSchema({
                  name: "Latest posts on the PowerMySport community blog",
                  path: "/blog",
                  items: recent.items.map((post) => ({
                    name: post.title,
                    path: `/blog/${post.id}`,
                  })),
                }),
              ]
            : []),
        ]}
      />
      <Suspense
        fallback={
          <div className="community-page-shell">
            <div className="community-content-wrap border-border rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
              <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
              <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
              <p className="mt-4 text-sm text-slate-500">Loading stories...</p>
            </div>
          </div>
        }
      >
        <BlogLandingClient />
      </Suspense>
    </>
  );
}
