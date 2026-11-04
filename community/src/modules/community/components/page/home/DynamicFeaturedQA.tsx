"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunityPostDetailResponse } from "@/modules/community/types";

/** The best-voted answered question, as a wash-tinted callout. Renders nothing
 *  when no question has an answer yet: an earlier version showed a made-up
 *  "Priya recommends" exchange here, and invented parent quotes do not belong
 *  on a community page. */
export default function DynamicFeaturedQA() {
  const [data, setData] = useState<CommunityPostDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFeaturedQA() {
      try {
        const postsResponse = await communityService.listPosts(1, 10, { sort: "TOP" });
        const topAnsweredPost = postsResponse.items?.find((p) => p.answerCount > 0);
        if (topAnsweredPost) {
          setData(await communityService.getPostDetails(topAnsweredPost.id));
        }
      } catch {
        // render nothing
      } finally {
        setIsLoading(false);
      }
    }
    loadFeaturedQA();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-wash rounded-3xl p-8" aria-busy="true">
        <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
        <div className="bg-ink/10 mt-5 h-7 w-4/5 animate-pulse rounded-sm" />
        <div className="bg-ink/10 mt-6 h-20 w-full animate-pulse rounded-sm" />
      </div>
    );
  }

  if (!data || !data.answers || data.answers.length === 0) return null;

  const { post, answers } = data;
  const topAnswer = [...answers].sort((a, b) => b.voteScore - a.voteScore)[0];

  return (
    <article className="bg-wash rounded-3xl p-7 sm:p-9">
      <p className="text-ink-body text-sm font-medium">Most helpful answer</p>
      <h3 className="font-editorial text-ink mt-3 text-balance text-3xl font-normal leading-tight">
        {post.title}
      </h3>
      <blockquote className="border-ink mt-6 border-l-2 pl-5">
        <p className="font-editorial text-ink line-clamp-5 text-xl font-light italic leading-relaxed">
          {topAnswer.content}
        </p>
        <footer className="text-ink-body mt-3 text-sm">
          Answered by {topAnswer.author.displayName}
        </footer>
      </blockquote>
      <Link
        href={`/questions/${post.id}`}
        className="text-ink decoration-ink/30 hover:decoration-ink mt-6 inline-flex items-center gap-1.5 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
      >
        Read the full thread
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </article>
  );
}
