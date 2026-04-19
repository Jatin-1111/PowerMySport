import QnAPostDetailClient from "@/modules/community/components/page/QnAPostDetailClient";

export default async function CommunityQnADetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return (
    <div className="min-h-[calc(100vh-88px)] bg-background">
      <QnAPostDetailClient postId={postId} />
    </div>
  );
}
