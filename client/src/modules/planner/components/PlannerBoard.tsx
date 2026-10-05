"use client";

import { LinkRankingPrompt } from "@/modules/planner/components/LinkRankingPrompt";
import { PlanPanel } from "@/modules/planner/components/PlanPanel";
import { RecommendationsSection } from "@/modules/planner/components/RecommendationsSection";
import { Timeline } from "@/modules/planner/components/Timeline";
import { usePlanner } from "@/modules/planner/hooks/usePlanner";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import { formatLongDate } from "@/modules/planner/utils/eventFormat";
import { rankedSportFor } from "@/modules/player/services/rankingClaim";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { PlannerEdition } from "@powermysport/shared-types";
import { ArrowRight } from "lucide-react";
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="font-title text-lg font-extrabold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
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
  const { plannedSlugs, add } = useSeasonPlan(dependentId);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-white px-5 py-4">
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">
            {standing.category} {standing.subcategory}, rank {standing.rank}
          </span>
          <span className="text-slate-500"> as on {formatLongDate(standing.asOnDate)}</span>
        </p>
        <p className="text-xs text-slate-500">
          Events are judged against this list. It updates when a new one is published.
        </p>
      </div>

      <Section
        title="Suggested season"
        description="Which of these events to put on the plan, and why."
      >
        <RecommendationsSection
          dependentId={dependentId}
          homeState={standing.state}
          calendar={calendar}
          plannedSlugs={plannedSlugs}
          isAdding={add.isPending}
          onAdd={(slug) => add.mutate(slug)}
        />
      </Section>

      <Section
        title="Their plan"
        description="Tournaments you have chosen, in the order they happen."
      >
        <PlanPanel
          dependentId={dependentId}
          calendar={calendar}
          annualCap={data.annualEntryCap}
          bracket={standing.subcategory}
        />
      </Section>

      <Section
        title="What they can enter"
        description={`Upcoming events judged against ${standing.category} ${standing.subcategory}, rank ${standing.rank}.`}
      >
        <Timeline
          shortlist={shortlist}
          plannedSlugs={plannedSlugs}
          isAdding={add.isPending}
          onAdd={(slug) => add.mutate(slug)}
        />
      </Section>
    </div>
  );
}
