"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Award, MessageCircle, ThumbsUp, X } from "lucide-react";
import { CommunityPost } from "@/modules/community/types";
import { LeaderboardItem } from "./types";

export function ContributorModal({
  contributor,
  threads,
  onClose,
}: {
  contributor: LeaderboardItem | null;
  threads: CommunityPost[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {contributor && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/45 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-[201] w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-900/5">
              <div className="relative shrink-0 border-b border-slate-100 bg-[linear-gradient(125deg,#fafdff_0%,#eaf4ff_60%,#fff1dc_100%)] px-6 py-6">
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:bg-white hover:text-slate-600"
                >
                  <X size={16} />
                </button>

                <div className="flex flex-col items-center text-center">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-4 ring-white">
                    {contributor.photoUrl ? (
                      <img
                        src={contributor.photoUrl}
                        alt={contributor.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-bold text-power-orange">
                        {contributor.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h2 className="font-title mt-3 text-lg font-bold text-slate-900">
                    {contributor.name}
                  </h2>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    Rank #{contributor.rank}
                  </span>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-4 gap-2 border-b border-slate-100 px-5 py-4">
                {[
                  { label: "Posts", value: contributor.posts },
                  { label: "Answers", value: contributor.answers },
                  { label: "Upvotes", value: contributor.upvotes },
                  { label: "Score", value: contributor.score },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-base font-bold text-slate-900">
                      {stat.value}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-b-[2rem] px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Questions Asked
                </p>
                {threads.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">
                    No thread history available.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {threads.map((post) => (
                      <Link
                        key={post.id}
                        href={`/q/${post.id}`}
                        onClick={onClose}
                        className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 transition hover:border-power-orange/40 hover:bg-white"
                      >
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                          {post.title}
                        </p>
                        <p className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle size={12} /> {post.answerCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp size={12} /> {post.upvoteCount}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Award size={12} /> {post.voteScore}
                          </span>
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
