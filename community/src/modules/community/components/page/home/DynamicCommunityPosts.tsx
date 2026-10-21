"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunityPost } from "@/modules/community/types";

/** The latest questions as a ruled list: hairline between rows, serif title,
 *  one quiet meta line. Rows link to the thread. */
export default function DynamicCommunityPosts() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const response = await communityService.listPosts(1, 3);
        setPosts(response.items || []);
      } catch {
        // fall through to the empty state
      } finally {
        setIsLoading(false);
      }
    }
    loadPosts();
  }, []);

  if (isLoading) {
    return (
      <div className="border-hairline border-t" aria-busy="true" aria-label="Loading questions">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-hairline space-y-3 border-b py-7">
            <div className="bg-ink/10 h-3 w-20 animate-pulse rounded-sm" />
            <div className="bg-ink/10 h-6 w-3/4 animate-pulse rounded-sm" />
            <div className="bg-ink/10 h-4 w-full animate-pulse rounded-sm" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="border-hairline border-t py-8">
        <p className="font-editorial text-ink text-2xl font-normal">No questions yet.</p>
        <p className="text-ink-body mt-2 max-w-[44ch] text-base leading-relaxed">
          Be the first to ask. Parents who have been through it will see it here.
        </p>
        <Link
          href="/questions"
          className="text-ink decoration-ink/30 hover:decoration-ink mt-4 inline-flex items-center gap-1.5 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
        >
          Ask a question
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ul className="border-hairline border-t">
        {posts.map((post) => (
          <li key={post.id} className="border-hairline border-b">
            <Link
              href={`/questions/${post.id}`}
              className="group -mx-3 block rounded-lg px-3 py-7 transition-colors duration-200 hover:bg-white/60"
            >
              <p className="text-ink-muted text-sm font-medium">{post.sport || "General"}</p>
              <h3 className="font-editorial text-ink mt-2 text-balance text-2xl font-normal leading-tight">
                {post.title}
              </h3>
              <p className="text-ink-body mt-2 line-clamp-2 max-w-[60ch] text-base leading-relaxed">
                {post.body}
              </p>
              <p className="text-ink-muted mt-4 flex items-center gap-2 text-sm">
                <span>{post.author?.displayName || "Anonymous"}</span>
                <span aria-hidden>·</span>
                <span>
                  {post.answerCount} {post.answerCount === 1 ? "answer" : "answers"}
                </span>
                <ArrowRight
                  className="text-ink ml-auto h-4 w-4 -translate-x-1 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100"
                  aria-hidden
                />
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/questions"
        className="text-ink decoration-ink/30 hover:decoration-ink mt-6 inline-flex items-center gap-1.5 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
      >
        Browse all questions
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
