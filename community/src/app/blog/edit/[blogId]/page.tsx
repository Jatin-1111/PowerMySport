import WriteBlogClient from "@/modules/community/components/blog/WriteBlogClient";

export default async function EditBlogPage({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const { blogId } = await params;
  return <WriteBlogClient mode="edit" blogId={blogId} />;
}
