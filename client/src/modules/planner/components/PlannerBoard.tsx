"use client";

import { LinkRankingPrompt } from "@/modules/planner/components/LinkRankingPrompt";
import { SeasonSummary } from "@/modules/planner/components/SeasonSummary";
import { SeasonWorkspace } from "@/modules/planner/components/SeasonWorkspace";
import { Timeline } from "@/modules/planner/components/Timeline";
import { useCosts } from "@/modules/planner/hooks/useCosts";
import { useRecommendations } from "@/modules/planner/hooks/useRecommendations";
import { usePlanner } from "@/modules/planner/hooks/usePlanner";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import { formatLongDate } from "@/modules/planner/utils/eventFormat";
import { rankedSportFor } from "@/modules/player/services/rankingClaim";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useState } from "react";
import type { PlannerEdition } from "@powermysport/shared-types";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";

/**
 * One child's planner. It owns the four states a child can be in, because each
 * says something different and none of them is an error:
 *
 *   - loading
 *   - no ranking linked: ask for it, here
 *   - linked, but on no junior list: say so, and why that means no verdicts
 *   - ready: the standing, the plan, and the calendar
 */

/**
 * The full list of what the child can enter, closed until it is wanted. It is the
 * reference the calendar and the suggestions are drawn from, and it also says which
 * events the child cannot enter and why, so it stays available but no longer sits
 * between the parent and their plan.
 */
function Collapsible({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h2 className="font-title text-lg font-extrabold text-slate-900">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg px-5 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:px-6"
        >
          <span>
            {title}
            <span className="mt-0.5 block text-sm font-normal text-slate-600">{description}</span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </h2>
      {open && <div className="border-t border-slate-100 p-5 sm:p-6">{children}</div>}
    </section>
  );
}

export function PlannerBoard({
  dependentId,
  dependentName,
  sport,
}: {
  dependentId: string;
  dependentName: string;
  /** The child's chosen sport, if they have one. Null means not chosen yet. */
  sport: string | null;
}) {
  const { data, isPending, isError, refetch } = usePlanner(dependentId);
  const { entries, preferences, plannedSlugs, add } = useSeasonPlan(dependentId);
  // The event open on the calendar. It lives here because opening one asks for its
  // estimate, and the estimates are fetched here.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // The suggestions on screen are priced alongside the plan. These hooks sit above
  // the early returns below so they run on every render.
  const { recommendations } = useRecommendations(dependentId);
  const suggestedSlugs = recommendations?.items.map((item) => item.slug) ?? [];
  const pricedSlugs = selectedSlug ? [...suggestedSlugs, selectedSlug] : suggestedSlugs;
  const {
    costs,
    isLoading: costsLoading,
    isError: costsFailed,
    saveHomeCity,
  } = useCosts(dependentId, pricedSlugs);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-700">We could not load this planner just now.</p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (data.linkState === "not-linked") {
    // A child whose chosen sport has no mirrored ranking list cannot be helped
    // by linking one, so offering it would be a dead end.
    if (sport && !rankedSportFor([sport])) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-title text-lg font-extrabold text-slate-900">
            The planner covers tennis for now
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            {dependentName} plays {sport}, and we do not yet hold a ranking list or entry rules for
            it. You can still browse its calendar on the tournaments page.
          </p>
          <Link
            href="/tournaments"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-700 hover:underline"
          >
            See tournaments
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      );
    }
    return <LinkRankingPrompt dependentId={dependentId} dependentName={dependentName} />;
  }

  if (data.linkState === "no-junior-standing" || !data.standing || !data.shortlist) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-title text-lg font-extrabold text-slate-900">
          {dependentName} is not on a junior list right now
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Their ranking is linked, but they do not appear on a current Under-12 to Under-18 list.
          Juniors often drop off between age categories. The entry rules the planner uses are
          written for those lists, so there is nothing to judge against until they are published
          again.
        </p>
      </div>
    );
  }

  const { standing, shortlist } = data;

  // Every event the page knows about, so a plan entry can borrow its end date
  // and venue from the live calendar.
  const calendar = new Map<string, PlannerEdition>();
  for (const entry of [
    ...shortlist.ownGroup,
    ...shortlist.playingUp,
    ...shortlist.unknown,
    ...shortlist.closed,
  ]) {
    if (entry.edition.slug) calendar.set(entry.edition.slug, entry.edition);
  }

  const openCount = shortlist.ownGroup.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">
            {standing.category} {standing.subcategory}, rank {standing.rank}
          </span>
          <span className="text-slate-500"> as on {formatLongDate(standing.asOnDate)}</span>
        </p>
        <p className="text-xs text-slate-500">
          Events are judged against this list. It updates when a new one is published.
        </p>
      </header>

      <SeasonSummary
        entries={entries}
        calendar={calendar}
        openCount={openCount}
        annualCap={data.annualEntryCap}
        bracket={standing.subcategory}
        costs={costs}
        costsLoading={costsLoading}
        costsFailed={costsFailed}
        saveHomeCity={{ saving: saveHomeCity.isPending, save: (city) => saveHomeCity.mutate(city) }}
        onOpenEvent={setSelectedSlug}
      />

      <SeasonWorkspace
        dependentId={dependentId}
        homeState={standing.state ?? null}
        shortlist={shortlist}
        planEntries={entries}
        preferences={preferences}
        recommendations={recommendations}
        calendar={calendar}
        costs={costs}
        costsLoading={costsLoading}
        plannedSlugs={plannedSlugs}
        isAdding={add.isPending}
        onAdd={(slug) => add.mutate(slug)}
        selectedSlug={selectedSlug}
        onSelect={setSelectedSlug}
      />

      <Collapsible
        title="Every event they can enter"
        description={`Upcoming events judged against ${standing.category} ${standing.subcategory}, rank ${standing.rank}, including the ones they cannot enter and why.`}
      >
        <Timeline
          shortlist={shortlist}
          plannedSlugs={plannedSlugs}
          isAdding={add.isPending}
          onAdd={(slug) => add.mutate(slug)}
        />
      </Collapsible>
    </div>
  );
}
