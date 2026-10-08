"use client";

import { Collapsible } from "@/modules/planner/components/Collapsible";
import { LinkRankingPrompt } from "@/modules/planner/components/LinkRankingPrompt";
import { PlannerTour } from "@/modules/planner/components/PlannerTour";
import { PreferencesPanel } from "@/modules/planner/components/PreferencesPanel";
import { SeasonSummary } from "@/modules/planner/components/SeasonSummary";
import { SeasonWorkspace, type WorkspaceTab } from "@/modules/planner/components/SeasonWorkspace";
import { Timeline } from "@/modules/planner/components/Timeline";
import { useCosts } from "@/modules/planner/hooks/useCosts";
import { useRecommendations } from "@/modules/planner/hooks/useRecommendations";
import { usePlanner } from "@/modules/planner/hooks/usePlanner";
import { usePlannerTour } from "@/modules/planner/hooks/usePlannerTour";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import { formatLongDate } from "@/modules/planner/utils/eventFormat";
import { rankClause, standingSentence } from "@/modules/planner/utils/standingText";
import { rankedSportFor } from "@/modules/player/services/rankingClaim";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useRef, useState } from "react";
import type { PlannerEdition } from "@powermysport/shared-types";
import { ArrowRight, CircleHelp } from "lucide-react";
import Link from "next/link";

/**
 * One child's planner. It owns the four states a child can be in, because each
 * says something different and none of them is an error:
 *
 *   - loading
 *   - no ranking linked: ask for it, here
 *   - linked, but on no junior ranking: say so, and why that means no verdicts
 *   - ready: the standing, the plan, and the calendar
 */

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
  const {
    entries,
    preferences,
    plannedSlugs,
    add,
    isLoading: planLoading,
  } = useSeasonPlan(dependentId);
  const tour = usePlannerTour();
  // The panel on show. A plan to look at if there is one; otherwise the suggestions,
  // which are what a parent with an empty plan has come for.
  const [tab, setTab] = useState<WorkspaceTab | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const browseRef = useRef<HTMLDivElement>(null);
  // The event open on the calendar. It lives here because opening one asks for its
  // estimate, and the estimates are fetched here.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // The suggestions on screen are priced alongside the plan. These hooks sit above
  // the early returns below so they run on every render.
  const { recommendations, suggest } = useRecommendations(dependentId);
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
          {dependentName} is not on a junior ranking right now
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Their ranking is linked, but they do not appear on a current Under-12 to Under-18 ranking.
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
  const activeTab: WorkspaceTab = tab ?? (entries.length > 0 ? "plan" : "suggested");

  // A parent who has set nothing and planned nothing has not started: open the setup
  // for them. Anyone else finds it closed, summarised in one line.
  const untouched =
    entries.length === 0 &&
    (!preferences ||
      (preferences.goal === "points" &&
        preferences.blockedRanges.length === 0 &&
        preferences.budget === null));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h2 className="font-title text-xl font-extrabold text-slate-900">
            {dependentName}&apos;s season
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {standingSentence(standing, formatLongDate(standing.asOnDate))}
          </p>
        </div>
        <button
          type="button"
          onClick={tour.start}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
          How this works
        </button>
      </header>

      {/* The rail on the right (what to do next, and the budget) stays in view while the
          main column scrolls. On a phone the same order stacks: setup, next step, then
          the plan. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {!planLoading && (
          <PreferencesPanel
            dependentId={dependentId}
            homeState={standing.state ?? null}
            defaultOpen={untouched}
          />
        )}

        <SeasonSummary
          entries={entries}
          calendar={calendar}
          childName={dependentName}
          openCount={openCount}
          costs={costs}
          costsLoading={costsLoading}
          costsFailed={costsFailed}
          saveHomeCity={{
            saving: saveHomeCity.isPending,
            save: (city) => saveHomeCity.mutate(city),
          }}
          onOpenEvent={setSelectedSlug}
          onSuggest={() => {
            setTab("suggested");
            suggest.mutate(false);
          }}
          suggesting={suggest.isPending}
          onBrowse={() => {
            setBrowseOpen(true);
            // The full list is at the foot of the page, so bring it up.
            requestAnimationFrame(() =>
              browseRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
            );
          }}
        />

        <div className="space-y-6 lg:col-start-1 lg:row-start-2">
          <SeasonWorkspace
            dependentId={dependentId}
            yearlyLimit={{ cap: data.annualEntryCap, ageGroup: standing.subcategory }}
            tab={activeTab}
            onTabChange={setTab}
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

          <div ref={browseRef}>
            <Collapsible
              title="Every event they can enter"
              description={`Upcoming events matched to ${standing.category} ${standing.subcategory}, ${rankClause(standing)}, including the ones they cannot enter and why.`}
              open={browseOpen}
              onOpenChange={setBrowseOpen}
            >
              <Timeline
                shortlist={shortlist}
                plannedSlugs={plannedSlugs}
                isAdding={add.isPending}
                onAdd={(slug) => add.mutate(slug)}
              />
            </Collapsible>
          </div>
        </div>
      </div>

      {tour.open && <PlannerTour onFinish={tour.finish} />}
    </div>
  );
}
