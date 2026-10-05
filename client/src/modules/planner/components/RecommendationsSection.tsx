"use client";

import { EventActions } from "@/modules/planner/components/EventActions";
import { PreferencesPanel } from "@/modules/planner/components/PreferencesPanel";
import { useRecommendations } from "@/modules/planner/hooks/useRecommendations";
import type {
  FallbackReason,
  RecommendationItem,
  Recommendations,
} from "@/modules/planner/services/planner";
import { eventLocation } from "@/modules/planner/utils/calendarLinks";
import { formatEventWindow, formatLongDate } from "@/modules/planner/utils/eventFormat";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import type { PlannerEdition } from "@powermysport/shared-types";
import { Info, MapPin, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";

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
  isPlanned,
  isAdding,
  onAdd,
}: {
  item: RecommendationItem;
  edition: PlannerEdition;
  isPlanned: boolean;
  isAdding: boolean;
  onAdd: () => void;
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
      {edition.registrationDeadlineDate && (
        <p className="mt-1 text-xs text-slate-600">
          Entries close {formatLongDate(edition.registrationDeadlineDate)}
        </p>
      )}
    </li>
  );
}

function Suggestions({
  recommendations,
  calendar,
  plannedSlugs,
  isAdding,
  onAdd,
}: {
  recommendations: Recommendations;
  calendar: Map<string, PlannerEdition>;
  plannedSlugs: Set<string>;
  isAdding: boolean;
  onAdd: (slug: string) => void;
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
          isPlanned={plannedSlugs.has(item.slug)}
          isAdding={isAdding}
          onAdd={() => onAdd(item.slug)}
        />
      ))}
    </ul>
  );

  const recommended = group("recommended");
  const consider = group("consider");

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

export function RecommendationsSection({
  dependentId,
  homeState,
  calendar,
  plannedSlugs,
  isAdding,
  onAdd,
}: {
  dependentId: string;
  homeState: string | null;
  /** Every event the page knows about, so a suggestion can be drawn in full. */
  calendar: Map<string, PlannerEdition>;
  plannedSlugs: Set<string>;
  isAdding: boolean;
  onAdd: (slug: string) => void;
}) {
  const { recommendations, usage, isLoading, isError, suggest } = useRecommendations(dependentId);
  const cap = usage?.cap ?? 10;
  const outOfSuggestions = Boolean(usage && usage.used >= usage.cap);

  return (
    <div className="space-y-5">
      <PreferencesPanel dependentId={dependentId} homeState={homeState} />

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : isError ? (
        <p className="text-sm text-slate-700">We could not load the suggestions just now.</p>
      ) : !recommendations ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="max-w-2xl text-sm leading-relaxed text-slate-700">
            Get a suggested season built from the events this child can enter, their plan so far,
            and the preferences above. An AI model chooses and explains the picks, and every one is
            checked against the entry rules before you see it.
          </p>
          <Button
            className="mt-4"
            disabled={suggest.isPending}
            onClick={() => suggest.mutate(false)}
          >
            <Sparkles className="mr-2 h-4 w-4" aria-hidden />
            {suggest.isPending ? "Working on it..." : "Suggest my season"}
          </Button>
        </div>
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
            calendar={calendar}
            plannedSlugs={plannedSlugs}
            isAdding={isAdding}
            onAdd={onAdd}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="max-w-xl text-xs leading-relaxed text-slate-500">
              {recommendations.source === "ai"
                ? "Chosen by an AI model from the events this child can enter, then checked against the entry rules."
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
