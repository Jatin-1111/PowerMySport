import type { Metadata } from "next";
import WriterProfileClient from "@/modules/community/components/blog/WriterProfileClient";
import { JsonLd } from "@/modules/community/components/seo/JsonLd";
import {
  buildMetadata,
  clampText,
  communityUrl,
  fetchPublicData,
} from "@/lib/seo";
import type { BlogAuthorProfile } from "@/modules/community/types";

const getAuthor = (identifier: string) =>
  fetchPublicData<BlogAuthorProfile>(
    `/community/blog/authors/${encodeURIComponent(identifier)}`,
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
      description:
        "Explore blogs and stories from PowerMySport community writers.",
      path: `/blog/writer/${identifier}`,
    });
  }

  const description = author.bio
    ? clampText(author.bio, 160)
    : `Read ${author.blogCount} sports ${author.blogCount === 1 ? "story" : "stories"} by ${author.name} on the PowerMySport community blog.`;

  return buildMetadata({
    title: `${author.name} (@${author.username})`,
    description,
    path: `/blog/writer/${identifier}`,
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
        url: communityUrl(`/blog/writer/${identifier}`),
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
      {profileSchema ? <JsonLd data={profileSchema} /> : null}
      <WriterProfileClient identifier={identifier} />
    </>
  );
}
