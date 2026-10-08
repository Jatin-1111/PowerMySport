"use client";

import { CostLine } from "@/modules/planner/components/CostLine";
import { EventActions } from "@/modules/planner/components/EventActions";
import { TimelineEventCard } from "@/modules/planner/components/TimelineEventCard";
import { ReachNote } from "@/modules/planner/components/ReachNote";
import { useRecommendations } from "@/modules/planner/hooks/useRecommendations";
import { useSeasonPlan } from "@/modules/planner/hooks/useSeasonPlan";
import type {
  EventCost,
  FallbackReason,
  RecommendationItem,
  Recommendations,
} from "@/modules/planner/services/planner";
import { eventLocation } from "@/modules/planner/utils/calendarLinks";
import { formatEventWindow, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { PlannerEdition, PlannerEntry, ReachVerdict } from "@powermysport/shared-types";
import { Info, MapPin, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * The suggested season: which of the events this child can enter to put on the
 * plan, and why.
 *
 * ── What a parent is and is not being told ──────────────────────────────────
 * The events here are all ones the entry rules already allow. A model chose and
 * ordered them and wrote each reason; it cannot add an event or change who may
 * enter, and the server checked its answer before it got here. The caption says
 * which of the model or the planner's own rules produced what is on screen, so a
 * fallback is never passed off as the model's work.
 *
 * Nothing here is automatic. A suggestion is made when the parent asks, because
 * each fresh one spends a limited allowance, and reopening the page is free.
 */

const FALLBACK_NOTICE: Record<FallbackReason, (cap: number) => string> = {
  "daily-limit": (cap) =>
    `You have used today's ${cap} fresh suggestions, so these come from the planner's own rules. Fresh suggestions return tomorrow.`,
  "ai-unavailable": () =>
    "The AI model could not be reached just now, so these come from the planner's own rules. Try again in a few minutes.",
  "invalid-output": () =>
    "The AI model's answer did not pass our checks, so these come from the planner's own rules.",
};

function SuggestionCard({
  item,
  edition,
  cost,
  costsLoading,
  isPlanned,
  isAdding,
  onAdd,
  verdict,
  onDismiss,
  dismissing,
}: {
  item: RecommendationItem;
  edition: PlannerEdition;
  cost: EventCost | undefined;
  costsLoading: boolean;
  isPlanned: boolean;
  isAdding: boolean;
  onAdd: () => void;
  /** What past draws showed for this event, when they showed anything. */
  verdict: ReachVerdict | undefined;
  onDismiss: () => void;
  dismissing: boolean;
}) {
  const location = eventLocation({ ...edition, venue: undefined });
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {edition.slug ? (
              <Link href={`/tournaments/${edition.slug}`} className="hover:underline">
                {edition.name}
              </Link>
            ) : (
              edition.name
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {formatEventWindow(edition.startDate, edition.endDate)}
            {location && (
              <span className="ml-3 inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {location}
              </span>
            )}
          </p>
        </div>
        <EventActions edition={edition} isPlanned={isPlanned} isAdding={isAdding} onAdd={onAdd} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.reason}</p>
      {/* A stretch already says what past draws showed, as its reason. */}
      {item.tier !== "reach" && (
        <div className="mt-1">
          <ReachNote verdict={verdict} />
        </div>
      )}
      <CostLine cost={cost} loading={costsLoading} />
      {edition.registrationDeadlineDate && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
          <span>Entries close {formatLongDate(edition.registrationDeadlineDate)}</span>
          {item.urgent && (
            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
              Closes soon
            </span>
          )}
        </p>
      )}
      <div className="mt-2 text-right">
        <button
          type="button"
          onClick={onDismiss}
          disabled={dismissing}
          aria-label={`${edition.name} is not for us`}
          className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-60"
        >
          Not for us
        </button>
      </div>
    </li>
  );
}

function Suggestions({
  recommendations,
  costs,
  costsLoading,
  calendar,
  plannedSlugs,
  isAdding,
  onAdd,
  reach,
  onDismiss,
  dismissing,
}: {
  recommendations: Recommendations;
  costs: Record<string, EventCost> | undefined;
  costsLoading: boolean;
  calendar: Map<string, PlannerEdition>;
  plannedSlugs: Set<string>;
  isAdding: boolean;
  onAdd: (slug: string) => void;
  reach: Record<string, ReachVerdict>;
  onDismiss: (slug: string) => void;
  dismissing: boolean;
}) {
  // An item whose event has left the calendar cannot be shown, and is dropped
  // rather than drawn half-empty.
  const shown = recommendations.items
    .map((item) => ({ item, edition: calendar.get(item.slug) }))
    .filter((entry): entry is { item: RecommendationItem; edition: PlannerEdition } =>
      Boolean(entry.edition)
    );
  const group = (tier: RecommendationItem["tier"]) =>
    shown.filter((entry) => entry.item.tier === tier);

  const render = (entries: ReturnType<typeof group>) => (
    <ul className="space-y-3">
      {entries.map(({ item, edition }) => (
        <SuggestionCard
          key={item.slug}
          item={item}
          edition={edition}
          cost={costs?.[item.slug]}
          costsLoading={costsLoading}
          isPlanned={plannedSlugs.has(item.slug)}
          isAdding={isAdding}
          onAdd={() => onAdd(item.slug)}
          verdict={reach[item.slug]}
          onDismiss={() => onDismiss(item.slug)}
          dismissing={dismissing}
        />
      ))}
    </ul>
  );

  const recommended = group("recommended");
  const consider = group("consider");
  const stretch = group("reach");

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-slate-700">{recommendations.summary}</p>

      {recommended.length > 0 && (
        <section aria-labelledby="suggested-heading">
          <h3
            id="suggested-heading"
            className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500"
          >
            Suggested
          </h3>
          {render(recommended)}
        </section>
      )}

      {consider.length > 0 && (
        <section aria-labelledby="consider-heading">
          <h3
            id="consider-heading"
            className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500"
          >
            Worth considering
          </h3>
          {render(consider)}
        </section>
      )}

      {stretch.length > 0 && (
        <section aria-labelledby="stretch-heading">
          <h3
            id="stretch-heading"
            className="mb-1 text-[12px] font-bold uppercase tracking-wider text-slate-500"
          >
            A stretch
          </h3>
          <p className="mb-3 text-xs leading-relaxed text-slate-600">
            Past draws of these closed above this rank. They are here so you know about them, not as
            picks.
          </p>
          {render(stretch)}
        </section>
      )}

      {shown.length === 0 && (
        <p className="text-sm text-slate-600">No open event fits right now.</p>
      )}

      {recommendations.notes.length > 0 && (
        <ul className="space-y-1">
          {recommendations.notes.map((note) => (
            <li key={note} className="flex gap-1.5 text-xs leading-relaxed text-slate-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Events the parent said were not for them, each one tap from coming back. */
function HiddenSuggestions({
  slugs,
  calendar,
  onRestore,
  restoring,
}: {
  slugs: string[];
  calendar: Map<string, PlannerEdition>;
  onRestore: (slug: string) => void;
  restoring: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (slugs.length === 0) return null;
  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        {slugs.length} left out as not for us {open ? "(hide)" : "(show)"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {slugs.map((slug) => (
            <li key={slug} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-slate-700">
                {calendar.get(slug)?.name ?? slug}
              </span>
              <button
                type="button"
                disabled={restoring}
                onClick={() => onRestore(slug)}
                aria-label={`Show ${calendar.get(slug)?.name ?? slug} again`}
                className="shrink-0 font-semibold text-orange-700 hover:underline disabled:opacity-60"
              >
                Show again
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RecommendationsSection({
  dependentId,
  costs,
  costsLoading,
  calendar,
  plannedSlugs,
  isAdding,
  onAdd,
  upcoming,
  openCount,
  reach,
}: {
  dependentId: string;
  /** Estimates by event, once priced. */
  costs: Record<string, EventCost> | undefined;
  costsLoading: boolean;
  /** Every event the page knows about, so a suggestion can be drawn in full. */
  calendar: Map<string, PlannerEdition>;
  plannedSlugs: Set<string>;
  isAdding: boolean;
  onAdd: (slug: string) => void;
  /** The next few events open to the child, shown while there are no suggestions yet. */
  upcoming: PlannerEntry[];
  /** How many events are open to the child in all. */
  openCount: number;
  /** What past draws showed for each open event, by slug. */
  reach: Record<string, ReachVerdict>;
}) {
  const { recommendations, usage, isLoading, isError, suggest } = useRecommendations(dependentId);
  const { dismissed, dismiss, restore } = useSeasonPlan(dependentId);
  const cap = usage?.cap ?? 10;
  const outOfSuggestions = Boolean(usage && usage.used >= usage.cap);

  return (
    <div className="space-y-5">
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : isError ? (
        <p className="text-sm text-slate-700">We could not load the suggestions just now.</p>
      ) : !recommendations ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="max-w-xl text-sm leading-relaxed text-slate-700">
              Want a short list built for you? It fits around your plan, the rest days between
              events, the yearly entries left and your budget, and leaves out events whose past
              draws closed above this rank. An AI model then writes why each one suits them.
            </p>
            <Button disabled={suggest.isPending} onClick={() => suggest.mutate(false)}>
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              {suggest.isPending ? "Working on it..." : "Suggest my season"}
            </Button>
          </div>

          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <h3
                id="upcoming-heading"
                className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-500"
              >
                Open to enter soon
                {openCount > upcoming.length ? ` (${upcoming.length} of ${openCount})` : ""}
              </h3>
              <ul className="space-y-3">
                {upcoming.map((entry) => (
                  <TimelineEventCard
                    key={entry.edition.slug ?? entry.edition.name}
                    entry={entry}
                    mode="open"
                    isPlanned={entry.edition.slug ? plannedSlugs.has(entry.edition.slug) : false}
                    isAdding={isAdding}
                    onAdd={() => entry.edition.slug && onAdd(entry.edition.slug)}
                    verdict={entry.edition.slug ? reach[entry.edition.slug] : undefined}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <>
          {recommendations.stale && (
            <div
              role="note"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <span>
                Their plan, ranking list or preferences have changed since these were made.
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={suggest.isPending}
                onClick={() => suggest.mutate(false)}
              >
                {suggest.isPending ? "Working on it..." : "Update suggestions"}
              </Button>
            </div>
          )}

          {recommendations.unchanged && (
            <p
              role="note"
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
            >
              Nothing has changed since these were made, so they are the same, and no fresh
              suggestion was used. Change your setup or your plan and ask again.
            </p>
          )}

          {recommendations.fallbackReason && (
            <p
              role="note"
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
            >
              {FALLBACK_NOTICE[recommendations.fallbackReason](cap)}
            </p>
          )}

          <Suggestions
            recommendations={recommendations}
            costs={costs}
            costsLoading={costsLoading}
            calendar={calendar}
            plannedSlugs={plannedSlugs}
            isAdding={isAdding}
            onAdd={onAdd}
            reach={reach}
            onDismiss={(slug) => dismiss.mutate(slug)}
            dismissing={dismiss.isPending}
          />

          <HiddenSuggestions
            slugs={dismissed}
            calendar={calendar}
            onRestore={(slug) => restore.mutate(slug)}
            restoring={restore.isPending}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="max-w-xl text-xs leading-relaxed text-slate-500">
              {recommendations.source === "ai"
                ? "The events were chosen by the planner's rules from what this child can enter. An AI model wrote the explanations, and each was checked against the data."
                : "Chosen by the planner's own rules from the events this child can enter."}{" "}
              Made {formatLongDate(recommendations.generatedAt)}.
              {usage && ` ${usage.used} of ${usage.cap} fresh suggestions used today.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={suggest.isPending || outOfSuggestions}
              onClick={() => suggest.mutate(true)}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
              {suggest.isPending ? "Working on it..." : "Suggest again"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
