import { Suspense } from "react";
import BlogLandingClient from "@/modules/community/components/blog/BlogLandingClient";
import {
  breadcrumbSchema,
  itemListSchema,
  JsonLd,
} from "@/modules/community/components/seo/JsonLd";
import { buildMetadata, communityUrl, fetchPublicData, SITE_NAME } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Parent Experiences — Tournaments, Academies, Gear & Costs",
  description:
    "Real experiences from parents — tournaments, academies, coaches, gear, travel and costs. Help another parent make a better decision.",
  path: "/experiences",
});

const experienceCollectionSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: `${SITE_NAME} Experiences`,
  description: "Parent experiences from the PowerMySport community.",
  url: communityUrl("/experiences"),
};

interface ExperienceListRow {
  id: string;
  title: string;
}

export default async function CommunityExperiencesPage() {
  // The landing UI fetches client-side, so without this the index page ships no
  // evidence of what it lists. One cached page of posts is enough to tell a
  // crawler this is a real, populated collection rather than an empty shell.
  const recent = await fetchPublicData<{ items?: ExperienceListRow[] }>(
    "/community/experiences/posts?page=1&limit=20"
  );

  return (
    <>
      <JsonLd
        data={[
          experienceCollectionSchema,
          breadcrumbSchema([
            { name: "Community", path: "/" },
            { name: "Experiences", path: "/experiences" },
          ]),
          ...(recent?.items?.length
            ? [
                itemListSchema({
                  name: "Latest parent experiences on PowerMySport",
                  path: "/experiences",
                  items: recent.items.map((post) => ({
                    name: post.title,
                    path: `/experiences/${post.id}`,
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
              <p className="mt-4 text-sm text-slate-500">Loading experiences...</p>
            </div>
          </div>
        }
      >
        <BlogLandingClient />
      </Suspense>
    </>
  );
}
