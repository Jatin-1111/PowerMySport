"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { rankingClaimApi, type RankingClaim } from "@/modules/player/services/rankingClaim";
import { fetchUpcomingEditions } from "@/modules/planner/services/editions";
import { buildShortlist, type PlannerEntry } from "@/modules/planner/utils/eligibility";
import { Badge } from "@/modules/shared/ui/Badge";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Info, MapPin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * Which of the next tournaments this child can actually enter.
 *
 * ── Why it needs a linked ranking ───────────────────────────────────────────
 * Two of the three rules need the rank: the reverse gate that closes Talent
 * Series to the top 75, and the age bracket, which is read from the list the
 * child is ranked in rather than from a birthday. Without a link there is
 * nothing to compute, so the card renders nothing rather than showing a
 * calendar the parent could already see on the tournaments page.
 *
 * ── Why closed events are shown ─────────────────────────────────────────────
 * The reverse gate is the least intuitive rule on the circuit, and the one
 * parents hit hardest: a rank worth celebrating is the rank that bars the
 * events their child has been winning. A shorter list teaches nothing. The
 * reason travels with each blocked row.
 */

const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const formatWindow = (entry: PlannerEntry): string => {
  const start = new Date(entry.edition.startDate);
  const end = entry.edition.endDate ? new Date(entry.edition.endDate) : null;
  if (!end || end.getTime() === start.getTime()) return DATE.format(start);
  return `${DATE.format(start)} to ${DATE.format(end)}`;
};

/**
 * The list a child belongs to, rather than one they are visiting.
 *
 * A player ranked in both U-14 and U-16 is a U-14 who plays up; judging their
 * entries against U-16 would let them "enter" events below their own age group.
 */
const homeStanding = (claim: RankingClaim) =>
  [...claim.standings]
    .filter((standing) => /^U-\d+$/i.test(standing.subcategory))
    .sort(
      (a, b) =>
        Number(/\d+/.exec(a.subcategory)?.[0] ?? 99) - Number(/\d+/.exec(b.subcategory)?.[0] ?? 99)
    )[0] ?? null;

function FixtureRow({ entry, tone }: { entry: PlannerEntry; tone: "open" | "muted" }) {
  return (
    <li className="border-b border-slate-100 py-3 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p
          className={
            tone === "open" ? "text-sm font-semibold text-slate-900" : "text-sm text-slate-600"
          }
        >
          {entry.edition.slug ? (
            <Link href={`/tournaments/${entry.edition.slug}`} className="hover:underline">
              {entry.edition.name}
            </Link>
          ) : (
            entry.edition.name
          )}
        </p>
        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {formatWindow(entry)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {entry.edition.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {entry.edition.city}
          </span>
        )}
        {entry.edition.ladder && <span>{entry.edition.ladder}</span>}
        {entry.playingUp && (
          <Badge className="border-slate-200 bg-slate-50 text-[11px] text-slate-600 hover:bg-slate-50">
            Playing up
          </Badge>
        )}
      </div>

      {tone === "muted" && <p className="mt-1 text-xs text-slate-500">{entry.reason}</p>}
      {entry.notes.length > 0 && tone === "open" && (
        <p className="mt-1 flex gap-1.5 text-xs leading-relaxed text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{entry.notes.join(" ")}</span>
        </p>
      )}
    </li>
  );
}

export function UpcomingFixturesCard({ dependentId }: { dependentId: string }) {
  const [showClosed, setShowClosed] = useState(false);
  const [showPlayingUp, setShowPlayingUp] = useState(false);
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);

  // The same cache entry the ranking card reads, so opening this page costs one
  // request for both.
  const { data: claims } = useQuery({
    queryKey: queryKeys.rankingClaims.all,
    queryFn: () => rankingClaimApi.list(),
    enabled: hydrated && Boolean(token),
  });

  const claim = claims?.find((entry) => entry.dependentId === dependentId) ?? null;
  const standing = claim ? homeStanding(claim) : null;

  const { data: editions, isPending } = useQuery({
    queryKey: queryKeys.tournamentEditions.upcoming(claim?.sportSlug ?? "tennis"),
    queryFn: () => fetchUpcomingEditions(claim!.sportSlug),
    enabled: Boolean(claim && standing),
  });

  // No link, or a linked player who has dropped off every list: there is no
  // rank to judge entries against, and guessing one would be worse than silence.
  if (!claim || !standing) return null;

  const shortlist = editions
    ? buildShortlist(editions, { bracket: standing.subcategory, rank: standing.rank })
    : null;

  return (
    <Card className="shop-surface premium-shadow overflow-hidden p-0">
      <ProfileSectionHeader
        icon={CalendarDays}
        title="What they can enter next"
        description={`Upcoming events judged against ${standing.category} ${standing.subcategory}, rank ${standing.rank}.`}
      />
      <CardContent className="p-6">
        {isPending || !shortlist ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        ) : shortlist.ownGroup.length === 0 &&
          shortlist.playingUp.length === 0 &&
          shortlist.closed.length === 0 ? (
          <p className="text-sm leading-relaxed text-slate-600">
            Nothing on the published calendar for this age group yet. The federation publishes a few
            weeks ahead, so this fills in as events are announced.
          </p>
        ) : (
          <>
            {shortlist.ownGroup.length > 0 ? (
              <ul>
                {shortlist.ownGroup.slice(0, 6).map((entry) => (
                  <FixtureRow
                    key={entry.edition.slug ?? entry.edition.name}
                    entry={entry}
                    tone="open"
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm leading-relaxed text-slate-600">
                Nothing in {standing.subcategory} on the current calendar is open to enter at this
                rank.
              </p>
            )}

            {/* Older age groups simply hold more events, so merging these into
                the list above buries a child's own fixtures under other
                people's. Playing up is also a real decision — it spends the
                same annual entry allowance — so it is offered, not assumed. */}
            {shortlist.playingUp.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPlayingUp((open) => !open)}
                  className="text-sm font-semibold text-slate-600 hover:underline"
                >
                  {showPlayingUp ? "Hide" : "Show"} {shortlist.playingUp.length} event
                  {shortlist.playingUp.length === 1 ? "" : "s"} in an older age group
                </button>
                {showPlayingUp && (
                  <ul className="mt-2">
                    {shortlist.playingUp.slice(0, 8).map((entry) => (
                      <FixtureRow
                        key={entry.edition.slug ?? entry.edition.name}
                        entry={entry}
                        tone="open"
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {shortlist.closed.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowClosed((open) => !open)}
                  className="text-sm font-semibold text-slate-600 hover:underline"
                >
                  {showClosed ? "Hide" : "Show"} {shortlist.closed.length} event
                  {shortlist.closed.length === 1 ? "" : "s"} they cannot enter
                </button>
                {showClosed && (
                  <ul className="mt-2">
                    {shortlist.closed.slice(0, 8).map((entry) => (
                      <FixtureRow
                        key={entry.edition.slug ?? entry.edition.name}
                        entry={entry}
                        tone="muted"
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Open means not barred by the published entry rules. Above Championship Series a draw
              is cut by ranking, so a place is earned rather than granted. Entry deadlines are not
              published on the calendar, so check each event&apos;s fact sheet.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
