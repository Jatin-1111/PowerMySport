import WriteBlogClient from "@/modules/community/components/blog/WriteBlogClient";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Edit Blog",
  description: "Edit your PowerMySport community blog post.",
  path: "/blog/edit",
  noindex: true,
});

export default async function EditBlogPage({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const { blogId } = await params;
  return <WriteBlogClient mode="edit" blogId={blogId} />;
}
