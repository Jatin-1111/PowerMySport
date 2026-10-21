"use client";

import Link from "next/link";
import { CommunityPost } from "@/modules/community/types";
import CommunityDialog from "@/modules/community/components/CommunityDialog";
import { LeaderboardItem } from "./types";

export function ContributorModal({
  contributor,
  threads,
  isLoadingThreads = false,
  onClose,
}: {
  contributor: LeaderboardItem | null;
  threads: CommunityPost[];
  isLoadingThreads?: boolean;
  onClose: () => void;
}) {
  return (
    <CommunityDialog
      isOpen={Boolean(contributor)}
      onClose={onClose}
      title={contributor?.name ?? ""}
      kicker={contributor ? `Rank ${contributor.rank}` : undefined}
      maxWidthClassName="max-w-md"
    >
      {contributor ? (
        <>
          <dl className="border-hairline grid grid-cols-4 border-y py-4 text-center">
            {[
              { label: "Posts", value: contributor.posts },
              { label: "Answers", value: contributor.answers },
              { label: "Upvotes", value: contributor.upvotes },
              { label: "Score", value: contributor.score },
            ].map((stat) => (
              <div key={stat.label}>
                <dd className="font-editorial text-ink text-3xl font-light tabular-nums">
                  {stat.value}
                </dd>
                <dt className="text-ink-muted mt-0.5 text-sm">{stat.label}</dt>
              </div>
            ))}
          </dl>

          <h3 className="font-editorial text-ink mt-6 text-2xl font-normal">Questions asked</h3>
          {isLoadingThreads ? (
            <div aria-busy="true" aria-label="Loading threads" className="mt-3 space-y-3">
              <div className="bg-ink/10 h-5 animate-pulse rounded-sm" />
              <div className="bg-ink/10 h-5 w-2/3 animate-pulse rounded-sm" />
            </div>
          ) : threads.length === 0 ? (
            <p className="text-ink-body mt-3 text-base">No questions yet.</p>
          ) : (
            <ul className="border-hairline mt-3 border-t">
              {threads.map((post) => (
                <li key={post.id} className="border-hairline border-b">
                  <Link
                    href={`/questions/${post.id}`}
                    onClick={onClose}
                    className="hover:bg-paper-deep/60 -mx-2 block px-2 py-3 transition-colors duration-200"
                  >
                    <p className="text-ink line-clamp-2 text-base font-medium">{post.title}</p>
                    <p className="text-ink-muted mt-1 text-sm tabular-nums">
                      {post.answerCount} {post.answerCount === 1 ? "answer" : "answers"} ·{" "}
                      {post.upvoteCount} {post.upvoteCount === 1 ? "upvote" : "upvotes"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </CommunityDialog>
  );
}
