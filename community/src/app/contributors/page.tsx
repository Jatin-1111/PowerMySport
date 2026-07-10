"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HelpCircle, MessageSquare, Star, ThumbsUp, Users } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunityPost } from "@/modules/community/types";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { ContributorModal } from "@/modules/community/components/contributors/ContributorModal";
import { LeaderboardItem } from "@/modules/community/components/contributors/types";

const LEADERBOARD_SIZE = 15;

export default function ContributorsPage() {
  return (
    <Suspense
      fallback={
        <div className="community-page-shell">
          <div className="community-content-wrap rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-6">
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
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedContributorId, setSelectedContributorId] = useState<
    string | null
  >(null);
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
        setCurrentUserId(session.id);

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

  // Full ranked leaderboard, derived from post authorship (posts, answers received, upvotes received).
  const fullLeaderboard = useMemo<LeaderboardItem[]>(() => {
    const byAuthor = new Map<
      string,
      Omit<LeaderboardItem, "rank">
    >();

    for (const post of posts) {
      const existing = byAuthor.get(post.author.id) || {
        id: post.author.id,
        name: post.author.displayName,
        photoUrl: post.author.photoUrl,
        posts: 0,
        answers: 0,
        upvotes: 0,
        score: 0,
      };

      existing.posts += 1;
      existing.answers += post.answerCount;
      existing.upvotes += post.upvoteCount;
      existing.score = existing.posts * 2 + existing.answers * 3 + existing.upvotes * 2;
      byAuthor.set(post.author.id, existing);
    }

    return [...byAuthor.values()]
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [posts]);

  const myEntry = useMemo(
    () => fullLeaderboard.find((item) => item.id === currentUserId) || null,
    [fullLeaderboard, currentUserId],
  );

  // "You" pinned first (true rank preserved), then fill to LEADERBOARD_SIZE with the rest.
  const displayRows = useMemo(() => {
    const others = fullLeaderboard.filter((item) => item.id !== myEntry?.id);
    const slotsForOthers = myEntry ? LEADERBOARD_SIZE - 1 : LEADERBOARD_SIZE;
    const rest = others.slice(0, Math.max(0, slotsForOthers));
    return myEntry ? [myEntry, ...rest] : rest;
  }, [fullLeaderboard, myEntry]);

  const selectedContributor = useMemo(
    () =>
      fullLeaderboard.find((item) => item.id === selectedContributorId) ||
      null,
    [fullLeaderboard, selectedContributorId],
  );
  const selectedContributorThreads = useMemo(
    () =>
      selectedContributorId
        ? posts
            .filter((post) => post.author.id === selectedContributorId)
            .slice(0, 12)
        : [],
    [posts, selectedContributorId],
  );

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap space-y-5">
        <CommunityPageHeader
          title="Contributor Leaderboard"
          subtitle="Recognizing players and coaches who share high-value community knowledge."
          badge="Leaderboard"
        />

        {myReputation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border border-amber-200/80 bg-[linear-gradient(125deg,#fff9ed_0%,#fffdf7_100%)] p-4 sm:p-5"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
              My Reputation
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Your Points", value: myReputation.totalPoints, icon: Star, tint: "bg-amber-100 text-amber-600" },
                { label: "Questions", value: myReputation.questionCount, icon: HelpCircle, tint: "bg-blue-100 text-blue-600" },
                { label: "Answers", value: myReputation.answerCount, icon: MessageSquare, tint: "bg-emerald-100 text-emerald-600" },
                { label: "Upvotes", value: myReputation.receivedUpvotes, icon: ThumbsUp, tint: "bg-rose-100 text-rose-600" },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  whileHover={{ y: -3, boxShadow: "0 8px 20px -6px rgba(0,0,0,0.08)" }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/90 p-3 shadow-sm"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${stat.tint}`}>
                    <stat.icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-tight text-slate-900">
                      {stat.value}
                    </p>
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {stat.label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="community-card">
            <p className="text-sm text-slate-500">Loading leaderboard...</p>
          </div>
        ) : (
          <>
            {/* Leaderboard list */}
            <section className="community-card overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-title text-base font-bold text-slate-900">
                  Top Contributors
                </h2>
              </div>

              {displayRows.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">
                  No contributor data yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid min-w-[560px] grid-cols-[3.5rem_1fr_5rem_5rem_5rem_5.5rem] items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>Place</span>
                    <span>Contributor</span>
                    <span className="text-center">Posts</span>
                    <span className="text-center">Answers</span>
                    <span className="text-center">Upvotes</span>
                    <span className="text-right">Points</span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {displayRows.map((item) => {
                      const isMe = item.id === currentUserId;
                      return (
                        <motion.button
                          key={item.id}
                          onClick={() => setSelectedContributorId(item.id)}
                          whileHover={{ backgroundColor: "rgba(248,250,252,1)" }}
                          className={`grid w-full min-w-[560px] grid-cols-[3.5rem_1fr_5rem_5rem_5rem_5.5rem] items-center gap-2 border-l-[3px] px-5 py-3 text-left transition ${
                            isMe
                              ? "border-l-power-orange/50 bg-power-orange/[0.04]"
                              : "border-l-transparent"
                          }`}
                        >
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                            {item.rank}
                          </span>
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                              {item.photoUrl ? (
                                <img
                                  src={item.photoUrl}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.name.charAt(0).toUpperCase()
                              )}
                            </span>
                            <span className="truncate text-sm font-semibold text-slate-900 hover:text-power-orange">
                              {item.name}
                            </span>
                            {isMe && (
                              <span className="shrink-0 rounded-full bg-power-orange px-2 py-0.5 text-[10px] font-bold text-white">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-center text-sm text-slate-700">
                            {item.posts}
                          </span>
                          <span className="text-center text-sm text-slate-700">
                            {item.answers}
                          </span>
                          <span className="text-center text-sm text-slate-700">
                            {item.upvotes}
                          </span>
                          <span className="text-right text-sm font-bold text-emerald-700">
                            {item.score} pts
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <ContributorModal
          contributor={selectedContributor}
          threads={selectedContributorThreads}
          onClose={() => setSelectedContributorId(null)}
        />

        <section className="community-card">
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
