"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Award, ChevronLeft, Trophy, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { communityService } from "@/modules/community/services/community";
import { CommunityPost } from "@/modules/community/types";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";

type LeaderboardItem = {
  id: string;
  name: string;
  posts: number;
  answersProxy: number;
  upvotes: number;
  score: number;
};

export default function ContributorsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading contributors...</p>
          </div>
        </div>
      }
    >
      <ContributorsPageContent />
    </Suspense>
  );
}

function ContributorsPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [myReputation, setMyReputation] = useState<{
    totalPoints: number;
    questionCount: number;
    answerCount: number;
    receivedUpvotes: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const session = await communityService.ensureSession();
        if (!isCommunityEligibleRole(session.role)) {
          redirectToMainLogin();
          return;
        }

        const [rep, list] = await Promise.all([
          communityService.getMyReputation(),
          communityService.listPosts(1, 120, { sort: "TOP" }),
        ]);

        setMyReputation(rep);
        setPosts(list.items || []);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load contributors",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const leaderboard = useMemo(() => {
    const byAuthor = new Map<string, LeaderboardItem>();

    for (const post of posts) {
      const existing = byAuthor.get(post.author.id) || {
        id: post.author.id,
        name: post.author.displayName,
        posts: 0,
        answersProxy: 0,
        upvotes: 0,
        score: 0,
      };

      existing.posts += 1;
      existing.answersProxy += post.answerCount;
      existing.upvotes += post.upvoteCount;
      existing.score =
        existing.posts * 2 + existing.answersProxy * 3 + existing.upvotes * 2;
      byAuthor.set(post.author.id, existing);
    }

    return [...byAuthor.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [posts]);

  const selectedAuthorId = searchParams.get("author") || "";
  const selectedAuthor = useMemo(
    () => leaderboard.find((item) => item.id === selectedAuthorId) || null,
    [leaderboard, selectedAuthorId],
  );
  const selectedAuthorThreads = useMemo(
    () =>
      posts.filter((post) => post.author.id === selectedAuthorId).slice(0, 12),
    [posts, selectedAuthorId],
  );

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <Link
          href="/q"
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft size={14} />
          Back to Q&A
        </Link>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-amber-600" />
            <h1 className="text-xl font-semibold text-slate-900">
              Contributor Leaderboard
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Recognizing players and coaches who share high-value community
            knowledge.
          </p>

          {myReputation && (
            <div className="mt-4 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-700">
                  Your Points
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {myReputation.totalPoints}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-700">
                  Questions
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {myReputation.questionCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-700">
                  Answers
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {myReputation.answerCount}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-amber-700">
                  Upvotes
                </p>
                <p className="text-lg font-bold text-slate-900">
                  {myReputation.receivedUpvotes}
                </p>
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="mt-6 text-sm text-slate-500">
              Loading leaderboard...
            </p>
          ) : leaderboard.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              No contributor data yet.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {leaderboard.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <Link
                        href={`/contributors?author=${encodeURIComponent(item.id)}`}
                        className="text-sm font-semibold text-slate-900 hover:text-power-orange"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {item.posts} posts • {item.answersProxy} answers •{" "}
                        {item.upvotes} upvotes
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <Award size={12} />
                    {item.score} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {selectedAuthor && (
          <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Contributor Profile: {selectedAuthor.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Post and answer history for this contributor.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Posts
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedAuthor.posts}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Answers
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedAuthor.answersProxy}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Upvotes
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedAuthor.upvotes}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  Score
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {selectedAuthor.score}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {selectedAuthorThreads.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No thread history available.
                </p>
              ) : (
                selectedAuthorThreads.map((post) => (
                  <Link
                    key={post.id}
                    href={`/q/${post.id}`}
                    className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {post.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {post.answerCount} answers • {post.upvoteCount} upvotes
                    </p>
                  </Link>
                ))
              )}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-power-orange" />
            <h2 className="text-lg font-semibold text-slate-900">
              Role Highlights
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Coaches and players with sustained answer quality gain more
            visibility across community spaces.
          </p>
        </section>
      </div>
    </div>
  );
}
