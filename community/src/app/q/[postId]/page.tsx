import type { Metadata } from "next";
import QnAPostDetailClient from "@/modules/community/components/page/QnAPostDetailClient";
import { JsonLd } from "@/modules/community/components/seo/JsonLd";
import {
  buildMetadata,
  clampText,
  communityUrl,
  fetchPublicData,
} from "@/lib/seo";
import type { CommunityPostDetailResponse } from "@/modules/community/types";

const getPost = (postId: string) =>
  fetchPublicData<CommunityPostDetailResponse>(`/community/posts/${postId}`);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const detail = await getPost(postId);
  const post = detail?.post;

  if (!post) {
    return buildMetadata({
      title: "Community Question",
      description:
        "Ask sports questions and get answers from players, coaches, and parents on PowerMySport.",
      path: `/q/${postId}`,
    });
  }

  const contextTags = [post.sport, post.city, post.category].filter(
    Boolean,
  ) as string[];

  return buildMetadata({
    title: post.title,
    description: clampText(post.body, 160),
    path: `/q/${postId}`,
    keywords: [...(post.tags ?? []), ...contextTags],
    type: "article",
    publishedTime: post.createdAt,
    modifiedTime: post.updatedAt,
    authors: post.author?.displayName ? [post.author.displayName] : undefined,
  });
}

export default async function CommunityQnADetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const detail = await getPost(postId);
  const post = detail?.post;
  const answers = detail?.answers ?? [];
  const topAnswer = [...answers].sort((a, b) => b.voteScore - a.voteScore)[0];

  const qaSchema = post
    ? {
        "@context": "https://schema.org",
        "@type": "QAPage",
        mainEntity: {
          "@type": "Question",
          name: post.title,
          text: clampText(post.body, 500),
          answerCount: post.answerCount,
          upvoteCount: post.upvoteCount,
          datePublished: post.createdAt,
          author: {
            "@type": "Person",
            name: post.author?.displayName || "PowerMySport Community",
          },
          url: communityUrl(`/q/${postId}`),
          ...(topAnswer
            ? {
                acceptedAnswer: {
                  "@type": "Answer",
                  text: clampText(topAnswer.content, 500),
                  upvoteCount: topAnswer.upvoteCount,
                  datePublished: topAnswer.createdAt,
                  url: communityUrl(`/q/${postId}`),
                  author: {
                    "@type": "Person",
                    name:
                      topAnswer.author?.displayName || "PowerMySport Community",
                  },
                },
              }
            : {}),
        },
      }
    : null;

  return (
    <div className="min-h-[calc(100vh-88px)] bg-background">
      {qaSchema ? <JsonLd data={qaSchema} /> : null}
      <QnAPostDetailClient postId={postId} />
    </div>
  );
}
