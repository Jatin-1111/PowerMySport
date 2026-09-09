import type { Metadata } from "next";
import WriterProfileClient from "@/modules/community/components/blog/WriterProfileClient";
import { breadcrumbSchema, JsonLd } from "@/modules/community/components/seo/JsonLd";
import { buildMetadata, clampText, communityUrl, fetchPublicData } from "@/lib/seo";
import type { BlogAuthorProfile } from "@/modules/community/types";

const getAuthor = (identifier: string) =>
  fetchPublicData<BlogAuthorProfile>(
    `/community/experiences/authors/${encodeURIComponent(identifier)}`
  );

export async function generateMetadata({
  params,
}: {
  params: Promise<{ identifier: string }>;
}): Promise<Metadata> {
  const { identifier } = await params;
  const author = await getAuthor(identifier);

  if (!author) {
    return buildMetadata({
      title: "Writer Profile",
      description: "Explore experiences shared by parents in the PowerMySport community.",
      path: `/experiences/by/${identifier}`,
    });
  }

  const description = author.bio
    ? clampText(author.bio, 160)
    : `Read ${author.blogCount} ${author.blogCount === 1 ? "experience" : "experiences"} shared by ${author.name} in the PowerMySport community.`;

  return buildMetadata({
    title: `${author.name} (@${author.username})`,
    description,
    path: `/experiences/by/${identifier}`,
    image: author.photoUrl || undefined,
    type: "profile",
  });
}

export default async function WriterProfilePage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  const author = await getAuthor(identifier);

  const profileSchema = author
    ? {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        url: communityUrl(`/experiences/by/${identifier}`),
        mainEntity: {
          "@type": "Person",
          name: author.name,
          alternateName: author.username,
          description: author.bio || undefined,
          image: author.photoUrl || undefined,
        },
      }
    : null;

  return (
    <>
      {author && profileSchema ? (
        <JsonLd
          data={[
            profileSchema,
            breadcrumbSchema([
              { name: "Community", path: "/" },
              { name: "Experiences", path: "/experiences" },
              { name: author.name, path: `/experiences/by/${identifier}` },
            ]),
          ]}
        />
      ) : null}
      <WriterProfileClient identifier={identifier} />
    </>
  );
}
