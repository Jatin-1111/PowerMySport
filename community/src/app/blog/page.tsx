import { Suspense } from "react";
import BlogLandingClient from "@/modules/community/components/blog/BlogLandingClient";
import { JsonLd } from "@/modules/community/components/seo/JsonLd";
import { buildMetadata, communityUrl, SITE_NAME } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Sports Blog — Stories, Tips & Expert Advice",
  description:
    "Read the PowerMySport community blog: coaching tips, training insights, and expert sports advice written by players, coaches, and parents.",
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

export default function CommunityBlogPage() {
  return (
    <>
      <JsonLd data={blogCollectionSchema} />
      <Suspense
        fallback={
          <div className="community-page-shell">
            <div className="community-content-wrap rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-6">
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
