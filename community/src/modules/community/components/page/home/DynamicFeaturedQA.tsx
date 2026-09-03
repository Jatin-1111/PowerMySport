"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunityPostDetailResponse } from "@/modules/community/types";

export default function DynamicFeaturedQA() {
  const [data, setData] = useState<CommunityPostDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFeaturedQA() {
      try {
        const postsResponse = await communityService.listPosts(1, 10, {
          sort: "TOP",
        });
        const topAnsweredPost = postsResponse.items?.find((p) => p.answerCount > 0);

        if (topAnsweredPost) {
          const details = await communityService.getPostDetails(topAnsweredPost.id);
          setData(details);
        }
      } catch (err) {
        // Silent catch
      } finally {
        setIsLoading(false);
      }
    }
    loadFeaturedQA();
  }, []);

  if (isLoading) {
    return (
      <div className="border-power-orange/20 relative overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,rgba(233,115,22,0.08),rgba(255,255,255,0.98))] p-5 shadow-sm">
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200/50" />
      </div>
    );
  }

  if (!data || !data.answers || data.answers.length === 0) {
    // Fallback if no answered posts exist in the community yet
    return (
      <div className="border-power-orange/20 relative overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,rgba(233,115,22,0.08),rgba(255,255,255,0.98))] p-5 shadow-sm shadow-slate-900/5">
        <div className="bg-power-orange/10 absolute -top-8 -right-8 h-28 w-28 rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="bg-power-orange/10 text-power-orange inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold">
              Featured Parent Q&A
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              Answered by a top-rated parent
            </span>
          </div>
          <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
            What sport helps a shy 9-year-old build confidence fast?
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Priya recommends a low-pressure group setting with frequent small wins, simple drills,
            and a coach who rewards effort before competition.
          </p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
            <p className="text-xs font-bold tracking-[0.22em] text-slate-500 uppercase">
              Parent takeaway
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Start with one session per week, pick a coach with strong parent reviews, and look for
              venues that keep practice times predictable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { post, answers } = data;
  const topAnswer = answers.sort((a, b) => b.voteScore - a.voteScore)[0];

  return (
    <div className="border-power-orange/20 relative overflow-hidden rounded-3xl border bg-[linear-gradient(135deg,rgba(233,115,22,0.08),rgba(255,255,255,0.98))] p-5 shadow-sm shadow-slate-900/5">
      <div className="bg-power-orange/10 absolute -top-8 -right-8 h-28 w-28 rounded-full blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="bg-power-orange/10 text-power-orange inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold">
            Featured Parent Q&A
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Answered by {topAnswer.author.displayName}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">{post.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{post.body}</p>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-bold tracking-[0.22em] text-slate-500 uppercase">
            Coach takeaway
          </p>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-700">{topAnswer.content}</p>
        </div>
      </div>
    </div>
  );
}
