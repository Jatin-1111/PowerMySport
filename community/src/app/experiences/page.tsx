import { Suspense } from "react";
import BlogLandingClient from "@/modules/community/components/blog/BlogLandingClient";
import ExperienceIndexFallback, {
  type ExperienceIndexRow,
} from "@/modules/community/components/blog/ExperienceIndexFallback";
import {
  breadcrumbSchema,
  itemListSchema,
  JsonLd,
} from "@/modules/community/components/seo/JsonLd";
import { buildMetadata, communityUrl, fetchPublicData, SITE_NAME } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Parent Experiences: Tournaments, Academies, Gear & Costs",
  description:
    "Real experiences from parents: tournaments, academies, coaches, gear, travel and costs. Help another parent make a better decision.",
  path: "/experiences",
});

const experienceCollectionSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: `${SITE_NAME} Experiences`,
  description: "Parent experiences from the PowerMySport community.",
  url: communityUrl("/experiences"),
};

export default async function CommunityExperiencesPage() {
  // The landing UI fetches client-side, so without this the index page ships no
  // evidence of what it lists. One cached page of posts is enough to tell a
  // crawler this is a real, populated collection rather than an empty shell.
  const recent = await fetchPublicData<{ items?: ExperienceIndexRow[] }>(
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
      <Suspense fallback={<ExperienceIndexFallback items={recent?.items ?? []} />}>
        <BlogLandingClient />
      </Suspense>
    </>
  );
}
