"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { communityService } from "@/modules/community/services/community";
import { CommunityLeaderboardResponse, CommunityPost } from "@/modules/community/types";
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
          <div
            aria-busy="true"
            aria-label="Loading contributors"
            className="community-content-wrap"
          >
            <div className="bg-ink/10 h-48 animate-pulse rounded-2xl" />
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
  const [leaderboard, setLeaderboard] = useState<CommunityLeaderboardResponse | null>(null);
  const [threadState, setThreadState] = useState<{
    forId: string;
    items: CommunityPost[];
  } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [selectedContributorId, setSelectedContributorId] = useState<string | null>(null);
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

        const [rep, board] = await Promise.all([
          communityService.getMyReputation(),
          communityService.listLeaderboard(LEADERBOARD_SIZE),
        ]);

        setMyReputation(rep);
        setLeaderboard(board);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load contributors");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const rows = useMemo<LeaderboardItem[]>(() => leaderboard?.items ?? [], [leaderboard]);

  const myEntry = leaderboard?.me ?? null;

  // "You" pinned first with your real rank, then the top of the board. Ranks
  // come from the server now, so a pinned #204 stays #204 instead of being
  // renumbered against whatever subset the page happened to load.
  const displayRows = useMemo(() => {
    const others = rows.filter((item) => item.id !== myEntry?.id);
    const slotsForOthers = myEntry ? LEADERBOARD_SIZE - 1 : LEADERBOARD_SIZE;
    const rest = others.slice(0, Math.max(0, slotsForOthers));
    return myEntry ? [myEntry, ...rest] : rest;
  }, [rows, myEntry]);

  const selectedContributor = useMemo(
    () => displayRows.find((item) => item.id === selectedContributorId) || null,
    [displayRows, selectedContributorId]
  );

  // Fetched per contributor rather than sliced out of a bulk post prefetch —
  // the server filters by author and leaves out anything they posted
  // anonymously.
  //
  // The result is tagged with the contributor it belongs to so both "which
  // threads" and "still loading" are derived rather than held in their own
  // state: nothing is set synchronously in the effect body, and a slow response
  // for a previously-opened contributor cannot paint into the current one.
  useEffect(() => {
    if (!selectedContributorId) {
      return;
    }

    let cancelled = false;
    void communityService
      .listPosts(1, 12, { sort: "TOP", authorId: selectedContributorId })
      .then((list) => {
        if (!cancelled) {
          setThreadState({
            forId: selectedContributorId,
            items: list.items || [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThreadState({ forId: selectedContributorId, items: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedContributorId]);

  const threads =
    threadState && threadState.forId === selectedContributorId ? threadState.items : [];
  const isLoadingThreads =
    Boolean(selectedContributorId) && threadState?.forId !== selectedContributorId;

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap">
        <CommunityPageHeader
          title="Contributor leaderboard"
          subtitle="Parents who share knowledge other parents can use."
          badge="Leaderboard"
        />

        {myReputation && (
          <section aria-labelledby="my-contribution" className="mt-12">
            <h2 id="my-contribution" className="font-editorial text-ink text-3xl font-light">
              Your contribution
            </h2>
            <dl className="border-hairline mt-4 grid grid-cols-2 border-t lg:grid-cols-4">
              {[
                { label: "Points", value: myReputation.totalPoints },
                { label: "Questions", value: myReputation.questionCount },
                { label: "Answers", value: myReputation.answerCount },
                { label: "Upvotes received", value: myReputation.receivedUpvotes },
              ].map((stat) => (
                <div key={stat.label} className="border-hairline border-b py-6 pr-4">
                  <dt className="text-ink-muted text-sm">{stat.label}</dt>
                  <dd className="font-editorial text-ink mt-1 text-5xl font-light tabular-nums">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-labelledby="top-contributors" className="mt-14">
          <h2 id="top-contributors" className="font-editorial text-ink text-3xl font-light">
            Top contributors
          </h2>

          {isLoading ? (
            <div
              aria-busy="true"
              aria-label="Loading leaderboard"
              className="border-hairline mt-4 border-t"
            >
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border-hairline border-b py-5">
                  <div className="bg-ink/10 h-5 w-1/2 animate-pulse rounded-sm" />
                </div>
              ))}
            </div>
          ) : displayRows.length === 0 ? (
            <div className="bg-paper-deep mt-4 rounded-2xl px-6 py-14 text-center">
              <p className="font-editorial text-ink text-3xl font-light">No contributors yet.</p>
              <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                Ask or answer a question and you will show up here.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <div className="border-hairline text-ink-muted grid min-w-[560px] grid-cols-[3.5rem_1fr_5rem_5rem_5rem_5.5rem] items-center gap-2 border-b border-t px-3 py-3 text-sm">
                <span>Place</span>
                <span>Contributor</span>
                <span className="text-right">Posts</span>
                <span className="text-right">Answers</span>
                <span className="text-right">Upvotes</span>
                <span className="text-right">Points</span>
              </div>

              <ul>
                {displayRows.map((item) => {
                  const isMe = item.id === currentUserId;
                  return (
                    <li
                      key={`${item.rank}-${item.id || item.name}`}
                      className="border-hairline border-b"
                    >
                      <button
                        type="button"
                        disabled={!item.id}
                        onClick={() => item.id && setSelectedContributorId(item.id)}
                        className={`hover:bg-paper-deep/60 grid min-h-14 w-full min-w-[560px] grid-cols-[3.5rem_1fr_5rem_5rem_5rem_5.5rem] items-center gap-2 px-3 py-3 text-left transition-colors duration-200 disabled:cursor-default ${
                          isMe ? "bg-wash/60" : ""
                        }`}
                      >
                        <span className="font-editorial text-ink text-2xl font-light tabular-nums">
                          {item.rank}
                        </span>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="bg-paper-deep text-ink-muted flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-semibold">
                            {item.photoUrl ? (
                              <img
                                src={item.photoUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              item.name.charAt(0).toUpperCase()
                            )}
                          </span>
                          <span className="text-ink truncate text-base font-semibold">
                            {item.name}
                          </span>
                          {isMe && <span className="text-ink-body shrink-0 text-sm">(you)</span>}
                        </span>
                        <span className="text-ink-body text-right text-base tabular-nums">
                          {item.posts}
                        </span>
                        <span className="text-ink-body text-right text-base tabular-nums">
                          {item.answers}
                        </span>
                        <span className="text-ink-body text-right text-base tabular-nums">
                          {item.upvotes}
                        </span>
                        <span className="text-ink text-right text-base font-semibold tabular-nums">
                          {item.score}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-ink-muted mt-4 text-sm">
                Parents with consistently useful answers get more visibility across the community.
              </p>
            </div>
          )}
        </section>

        <ContributorModal
          contributor={selectedContributor}
          threads={threads}
          isLoadingThreads={isLoadingThreads}
          onClose={() => setSelectedContributorId(null)}
        />
      </div>
    </div>
  );
}
