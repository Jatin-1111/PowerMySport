"use client";

import { Collapsible } from "@/modules/planner/components/Collapsible";
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
import type { PlannerEdition, ReachVerdict, Shortlist } from "@powermysport/shared-types";
import { CalendarDays, List } from "lucide-react";
import { useState } from "react";

/**
 * Choosing tournaments, the plan they become, and the calendar they sit on.
 *
 * ── One column, one job at a time ───────────────────────────────────────────
 * The plan and the suggestions are two tabs of one panel, because a parent is doing
 * one or the other, and the panel is the page's centre. The calendar is below it and
 * closed: it is for checking clashes and seeing the season by month, and a parent can
 * plan without it. An earlier layout put the calendar first with the panel beside it
 * and the event details in a third tab; a parent's first screen was a wall of bars.
 *
 * An event's details always open in a dialog, from the calendar, the list or the
 * "do this next" box, so there is one way to look at an event, not two.
 *
 * Which event is open belongs to the board, not to this component, because the board
 * prices it: an event nobody has planned or been suggested has no estimate until
 * someone looks at it, and looking at it is what asks for one.
 */

export type WorkspaceTab = "plan" | "suggested";

export function SeasonWorkspace({
  dependentId,
  yearlyLimit,
  tab,
  onTabChange,
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
  reach,
}: {
  dependentId: string;
  yearlyLimit: { cap: number | null; ageGroup: string };
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
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
  /** What past draws showed for each open event, by slug. */
  reach: Record<string, ReachVerdict>;
}) {
  const isWide = useIsWide();
  const [showAvailable, setShowAvailable] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");

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
      heading={false}
      reach={reach[selected.slug]}
      onClose={() => onSelect(null)}
    />
  );

  const planCount = planEntries.length;
  const suggestedCount = recommendations?.items.length ?? 0;

  const trigger =
    "min-h-11 rounded-none border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-none data-[state=active]:border-orange-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-900 data-[state=active]:shadow-none";

  return (
    <div className="space-y-6">
      <section
        aria-label="Your plan and suggestions"
        data-tour="pick"
        className="rounded-lg border border-slate-200 bg-white"
      >
        <Tabs
          value={tab}
          onValueChange={(value) => {
            onTabChange(value as WorkspaceTab);
          }}
        >
          <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-slate-200 bg-transparent p-0 px-2">
            <TabsTrigger value="plan" className={trigger}>
              Your plan{planCount > 0 ? ` (${planCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="suggested" className={trigger}>
              Suggested{suggestedCount > 0 ? ` (${suggestedCount})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* Both stay mounted and the inactive one is hidden, so a figure half
              typed or a panel left open is still there when the parent comes back. */}
          <TabsContent value="plan" forceMount className="mt-0 p-4 data-[state=inactive]:hidden">
            <PlanPanel
              dependentId={dependentId}
              calendar={calendar}
              costs={costs}
              costsLoading={costsLoading}
              yearlyLimit={yearlyLimit}
            />
          </TabsContent>
          <TabsContent
            value="suggested"
            forceMount
            className="mt-0 p-4 data-[state=inactive]:hidden"
          >
            <RecommendationsSection
              dependentId={dependentId}
              costs={eventCosts}
              costsLoading={costsLoading}
              calendar={calendar}
              plannedSlugs={plannedSlugs}
              isAdding={isAdding}
              onAdd={onAdd}
              upcoming={shortlist.ownGroup.slice(0, 4)}
              openCount={shortlist.ownGroup.length}
              reach={reach}
            />
          </TabsContent>
        </Tabs>
      </section>

      <Collapsible
        tour="calendar"
        title="Season calendar"
        description="See your tournaments month by month and spot clashes."
      >
        {isWide && (
          <div
            role="group"
            aria-label="How to show the season"
            className="mb-4 flex justify-end gap-1"
          >
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
      </Collapsible>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => onSelect(null)}
        title={selected?.name}
        size="md"
      >
        {detail}
      </Modal>
    </div>
  );
}
