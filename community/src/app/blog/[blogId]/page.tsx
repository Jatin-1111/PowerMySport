import BlogDetailClient from "@/modules/community/components/blog/BlogDetailClient";

export default async function CommunityBlogDetailPage({
  params,
}: {
  params: Promise<{ blogId: string }>;
}) {
  const { blogId } = await params;
  return <BlogDetailClient blogId={blogId} />;
}
