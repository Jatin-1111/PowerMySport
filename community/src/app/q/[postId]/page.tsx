import QnAPostDetailClient from "@/modules/community/components/page/QnAPostDetailClient";

export default async function CommunityQnADetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return <QnAPostDetailClient postId={postId} />;
}
