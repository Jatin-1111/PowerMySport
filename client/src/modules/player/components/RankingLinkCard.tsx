"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import LinkRankingModal from "@/modules/player/components/LinkRankingModal";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import {
  rankedSportFor,
  rankingClaimApi,
  standingHref,
  standingListLabel,
  type RankingClaim,
} from "@/modules/player/services/rankingClaim";
import { RankDelta } from "@/modules/rankings/components/RankDelta";
import { Button } from "@/modules/shared/ui/Button";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Link2Off, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * A child's federation ranking, on their own profile.
 *
 * ── Why this shows the live standing rather than a stored one ────────────────
 * The link records only "this profile is that registration number". Rank and
 * points come back with every read, straight from the weekly mirror, because a
 * copy kept here would be a second version of the truth with its own staleness
 * and no way to tell which one was right.
 *
 * ── The empty state is a real state, not an error ────────────────────────────
 * A linked player with no standings has not broken anything: juniors age out of
 * one list before appearing in the next, and a player can simply drop off. Said
 * plainly, because a parent reading "no ranking found" under their child's name
 * deserves to know which of those it is.
 */

const formatAsOn = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function RankingLinkCard({
  dependentId,
  dependentName,
  sports,
}: {
  dependentId: string;
  dependentName: string;
  /** The child's sports, chosen first. Decides whether the claim is offered. */
  sports: Array<string | null | undefined>;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);

  const sportSlug = rankedSportFor(sports);

  /**
   * The account's links, not this child's. The endpoint returns all of them, so
   * opening a second child's profile reads the same cache entry instead of
   * issuing another request. Gated on the session for the reason the community
   * hooks are: the axios interceptor answers a 401 by navigating away, so a
   * request fired before hydration can throw the user off the page.
   */
  const { data: claims, isPending } = useQuery({
    queryKey: queryKeys.rankingClaims.all,
    queryFn: () => rankingClaimApi.list(),
    enabled: hydrated && Boolean(token),
  });

  const claim: RankingClaim | null =
    claims?.find((entry) => entry.dependentId === dependentId) ?? null;

  const unlink = useMutation({
    mutationFn: (id: string) => rankingClaimApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rankingClaims.all });
      toast.success("Ranking unlinked.");
    },
    onError: () => toast.error("Could not unlink that ranking. Please try again."),
  });

  const isLoading = isPending && hydrated && Boolean(token);

  // Nothing to say, so say nothing. A child in a sport with no mirrored ranking
  // list gets no card at all rather than an offer that cannot be fulfilled. The
  // exception is a child who already has a link — possible if their sport was
  // changed afterwards — because hiding a live link is worse than a stray card.
  if (!sportSlug && (isLoading || !claim)) return null;

  return (
    // The modal sits beside the card rather than inside it. `Modal` portals to
    // `document.body` now, so this is no longer load-bearing — but a card with
    // `backdrop-blur-md` and `overflow-hidden` is a bad place to write an
    // overlay, and keeping them siblings says so.
    <>
      <Card className="shop-surface premium-shadow overflow-hidden p-0">
        <ProfileSectionHeader
          icon={Trophy}
          title="Federation ranking"
          description="Their official standing, updated when a new list is published."
        />
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : !claim ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-600">
                If {dependentName} is on a federation ranking list, link it here to see their rank,
                weekly movement and points without going looking for the list each time.
              </p>
              <Button onClick={() => setIsModalOpen(true)}>Link a ranking</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {claim.standings.length === 0 ? (
                <p className="text-sm leading-relaxed text-slate-600">
                  Linked to registration number {claim.regNo}, but they are not on the current list.
                  Juniors often drop off between age categories; their standing reappears here as
                  soon as they are published again.
                </p>
              ) : (
                <ul className="space-y-3">
                  {claim.standings.map((standing) => (
                    <li
                      key={`${standing.category}-${standing.subcategory}`}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          #{standing.rank}
                          <span className="ml-2 font-normal text-slate-600">
                            {standingListLabel(standing)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {standing.totalPoints} points, as on {formatAsOn(standing.asOnDate)}
                        </p>
                      </div>
                      <RankDelta delta={standing.rankDelta} hasBaseline />
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={standingHref(claim)}
                  className="text-power-orange inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                >
                  See full ranking history
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlink.mutate(claim.id)}
                  disabled={unlink.isPending}
                  className="text-slate-500"
                >
                  <Link2Off className="mr-1.5 h-4 w-4" aria-hidden />
                  {unlink.isPending ? "Unlinking..." : "Unlink"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LinkRankingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dependentId={dependentId}
        dependentName={dependentName}
        sportSlug={sportSlug ?? "tennis"}
        onLinked={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.rankingClaims.all });
          toast.success("Ranking linked.");
        }}
      />
    </>
  );
}
