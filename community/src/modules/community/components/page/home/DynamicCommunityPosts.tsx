"use client";

import { useEffect, useState } from "react";
import { MessageSquareQuote } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunityPost } from "@/modules/community/types";

export default function DynamicCommunityPosts() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const response = await communityService.listPosts(1, 3);
        setPosts(response.items || []);
      } catch (err) {
        // fallback to empty
      } finally {
        setIsLoading(false);
      }
    }
    loadPosts();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
        No recent posts available.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => {
        return (
          <article
            key={post.id}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-100 text-slate-600">
                {post.sport || "General"}
              </span>
              <MessageSquareQuote className="mt-0.5 h-4 w-4 text-slate-300" />
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">
              {post.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 line-clamp-2">
              {post.body}
            </p>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span>{post.author?.displayName || "Anonymous"}</span>
              <span>
                {post.answerCount}{" "}
                {post.answerCount === 1 ? "answer" : "answers"}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
