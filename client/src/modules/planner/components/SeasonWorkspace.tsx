"use client";

import { EventDetail } from "@/modules/planner/components/EventDetail";
import { PlanPanel } from "@/modules/planner/components/PlanPanel";
import { RecommendationsSection } from "@/modules/planner/components/RecommendationsSection";
import { SeasonAgenda } from "@/modules/planner/components/SeasonAgenda";
import { SeasonCalendar } from "@/modules/planner/components/SeasonCalendar";
import { useIsWide } from "@/modules/planner/hooks/useIsWide";
import type { CostResponse, EventCost, Recommendations } from "@/modules/planner/services/planner";
import type { PlanPreferences, SeasonPlanEntry } from "@/modules/planner/services/seasonPlan";
import { buildCalendarItems } from "@/modules/planner/utils/calendarItems";
import {
  defaultMonth,
  itemsInMonth,
  monthChoices,
  monthKeyOf,
} from "@/modules/planner/utils/calendarMonths";
import { Modal } from "@/modules/shared/ui/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/shared/ui/Tabs";
import { cn } from "@/utils/cn";
import type { PlannerEdition, Shortlist } from "@powermysport/shared-types";
import { CalendarDays, List } from "lucide-react";
import { useState } from "react";

/**
 * The calendar and the panel that works on it.
 *
 * ── Why they sit together ───────────────────────────────────────────────────
 * The plan, the suggestions and one event's details are three views of the same
 * events, and a parent moves between them constantly: look at an event, add it, see
 * the plan change, ask what else fits. As three full-width sections stacked down the
 * page that meant a long scroll between each step. Beside the calendar they are one
 * click apart and the calendar is still in view while they are used.
 *
 * ── The panel ───────────────────────────────────────────────────────────────
 * Plan and Suggested are tabs. Selecting an event on the calendar adds a third, the
 * event itself, and closing it returns to where they were. On a narrow screen the
 * event opens in a dialog instead, and what the calendar draws becomes a list,
 * because seven narrow columns cannot hold a readable event name.
 *
 * In the document the panel comes first and the calendar second. On a phone that is
 * also the order on the screen, which is the order a parent wants (their plan, then
 * the season), and on a wide screen the grid places the calendar on the left.
 *
 * Which event is open belongs to the board, not to this component, because the board
 * prices it: an event nobody has planned or been suggested has no estimate until
 * someone looks at it, and looking at it is what asks for one.
 */

type Tab = "plan" | "suggested";

export function SeasonWorkspace({
  dependentId,
  homeState,
  shortlist,
  planEntries,
  preferences,
  recommendations,
  calendar,
  costs,
  costsLoading,
  plannedSlugs,
  isAdding,
  onAdd,
  selectedSlug,
  onSelect,
}: {
  dependentId: string;
  homeState: string | null;
  shortlist: Shortlist;
  planEntries: SeasonPlanEntry[];
  preferences: PlanPreferences | undefined;
  recommendations: Recommendations | null;
  calendar: Map<string, PlannerEdition>;
  costs: CostResponse | null;
  costsLoading: boolean;
  plannedSlugs: Set<string>;
  isAdding: boolean;
  onAdd: (slug: string) => void;
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
}) {
  const isWide = useIsWide();
  const [showAvailable, setShowAvailable] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  // A plan to look at if there is one; otherwise the suggestions, which are what a
  // parent with an empty plan has come for.
  const [tab, setTab] = useState<Tab>(() => (planEntries.length > 0 ? "plan" : "suggested"));

  const items = buildCalendarItems({
    shortlist,
    planEntries,
    suggestions: recommendations?.items ?? [],
    showAvailable,
    selectedSlug,
  });
  const selected = items.find((item) => item.slug === selectedSlug) ?? null;
  const today = new Date().toISOString().slice(0, 10);

  // The month on show. The parent's choice is kept while it is still on offer;
  // otherwise it is this month, or the first one with something still to come.
  const months = monthChoices({ items, today });
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const monthKey =
    chosenMonth && months.some((choice) => choice.key === chosenMonth)
      ? chosenMonth
      : defaultMonth(months, items, today);
  const month = months.find((choice) => choice.key === monthKey) ?? months[0]!;

  // Opening an event from somewhere other than the calendar (the "next up" tile) must
  // not leave the calendar on a month the event is not in. Adjusted while rendering,
  // as React advises for state that follows a prop, so there is no flash of the wrong month.
  const [seenSlug, setSeenSlug] = useState<string | null>(null);
  if (selectedSlug !== seenSlug) {
    setSeenSlug(selectedSlug);
    if (selected && itemsInMonth(month, [selected]).length === 0) {
      const target = monthKeyOf(selected.startDate);
      if (months.some((choice) => choice.key === target)) setChosenMonth(target);
    }
  }
  const eventCosts: Record<string, EventCost> | undefined = costs?.events;
  const showGrid = isWide && view === "calendar";

  const detail = selected && (
    <EventDetail
      item={selected}
      dependentId={dependentId}
      cost={eventCosts?.[selected.slug]}
      costsLoading={costsLoading}
      heading={isWide}
      onClose={() => onSelect(null)}
    />
  );

  // On a wide screen an open event takes the panel. Choosing another tab closes it.
  const active: Tab | "event" = isWide && selected ? "event" : tab;
  const planCount = planEntries.length;
  const suggestedCount = recommendations?.items.length ?? 0;

  const trigger =
    "min-h-11 rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-none data-[state=active]:border-orange-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-900 data-[state=active]:shadow-none";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <section
        aria-label="Plan, suggestions and event details"
        className="rounded-lg border border-slate-200 bg-white lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
      >
        <Tabs
          value={active}
          onValueChange={(value) => {
            if (value === "event") return;
            setTab(value as Tab);
            if (selected) onSelect(null);
          }}
        >
          <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-slate-200 bg-transparent p-0 px-2">
            <TabsTrigger value="plan" className={trigger}>
              Plan{planCount > 0 ? ` (${planCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="suggested" className={trigger}>
              Suggested{suggestedCount > 0 ? ` (${suggestedCount})` : ""}
            </TabsTrigger>
            {isWide && selected && (
              <TabsTrigger value="event" className={trigger}>
                Event
              </TabsTrigger>
            )}
          </TabsList>

          {/* Both stay mounted and the inactive one is hidden, so a figure half
              typed or a panel left open is still there when the parent comes back. */}
          <TabsContent value="plan" forceMount className="mt-0 p-4 data-[state=inactive]:hidden">
            <PlanPanel
              dependentId={dependentId}
              calendar={calendar}
              costs={costs}
              costsLoading={costsLoading}
            />
          </TabsContent>
          <TabsContent
            value="suggested"
            forceMount
            className="mt-0 p-4 data-[state=inactive]:hidden"
          >
            <RecommendationsSection
              dependentId={dependentId}
              homeState={homeState}
              costs={eventCosts}
              costsLoading={costsLoading}
              calendar={calendar}
              plannedSlugs={plannedSlugs}
              isAdding={isAdding}
              onAdd={onAdd}
            />
          </TabsContent>
          {isWide && selected && (
            <TabsContent value="event" className="mt-0 p-4">
              {detail}
            </TabsContent>
          )}
        </Tabs>
      </section>

      <section
        aria-labelledby="season-calendar"
        className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 lg:col-start-1 lg:row-start-1"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="season-calendar" className="font-title text-lg font-extrabold text-slate-900">
            Season calendar
          </h2>
          {isWide && (
            <div role="group" aria-label="How to show the season" className="flex gap-1">
              {(
                [
                  ["calendar", "Calendar", CalendarDays],
                  ["list", "List", List],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold",
                    view === value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          {showGrid ? (
            <SeasonCalendar
              items={items}
              blocked={preferences?.blockedRanges ?? []}
              today={today}
              month={month}
              months={months}
              onMonthChange={setChosenMonth}
              selectedSlug={selectedSlug}
              onSelect={(slug) => onSelect(slug === selectedSlug ? null : slug)}
              showAvailable={showAvailable}
              onToggleAvailable={setShowAvailable}
            />
          ) : (
            <div>
              <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showAvailable}
                  onChange={(event) => setShowAvailable(event.target.checked)}
                />
                Show every event they can enter
              </label>
              <SeasonAgenda
                items={items}
                selectedSlug={selectedSlug}
                onSelect={(slug) => onSelect(slug === selectedSlug ? null : slug)}
              />
            </div>
          )}
        </div>
      </section>

      {!isWide && (
        <Modal
          isOpen={Boolean(selected)}
          onClose={() => onSelect(null)}
          title={selected?.name}
          size="md"
        >
          {detail}
        </Modal>
      )}
    </div>
  );
}
