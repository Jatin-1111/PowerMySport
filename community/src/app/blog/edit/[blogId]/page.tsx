import WriteBlogClient from "@/modules/community/components/blog/WriteBlogClient";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

// Per-post canonical — the static `path: "/blog/edit"` it replaced gave every
// blogId the same canonical URL. See the note in join/[code]/layout.tsx.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ blogId: string }>;
}): Promise<Metadata> {
  const { blogId } = await params;
  return buildMetadata({
    title: "Edit Blog",
    description: "Edit your PowerMySport community blog post.",
    path: `/blog/edit/${blogId}`,
    noindex: true,
  });
}

export default async function EditBlogPage({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const { blogId } = await params;
  return <WriteBlogClient mode="edit" blogId={blogId} />;
}
