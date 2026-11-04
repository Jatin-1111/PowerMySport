"use client";

import { EventDetail } from "@/modules/planner/components/EventDetail";
import { PlanPanel } from "@/modules/planner/components/PlanPanel";
import { RecommendationsSection } from "@/modules/planner/components/RecommendationsSection";
import { TournamentFinder, type FinderView } from "@/modules/planner/components/TournamentFinder";
import { useIsWide } from "@/modules/planner/hooks/useIsWide";
import type { CostResponse, EventCost, Recommendations } from "@/modules/planner/services/planner";
import type { PlanPreferences, SeasonPlanEntry } from "@/modules/planner/services/seasonPlan";
import { buildCalendarItems } from "@/modules/planner/utils/calendarItems";
import {
  filterItems,
  filterOptions,
  filterShortlist,
  NO_FILTERS,
  type FinderFilters,
} from "@/modules/planner/utils/finderFilters";
import { splitByEntryState } from "@/modules/planner/utils/timeline";
import {
  defaultMonth,
  itemsInMonth,
  monthChoices,
  monthKeyOf,
} from "@/modules/planner/utils/calendarMonths";
import { Modal } from "@/modules/shared/ui/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/shared/ui/Tabs";
import type { PlannerEdition, ReachVerdict, Shortlist } from "@powermysport/shared-types";
import { motion } from "framer-motion";
import { useState, type RefObject } from "react";
import { BLOCK } from "@/modules/planner/utils/motion";

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
  finder,
  afterPlan,
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
  /** The tournament finder is opened from elsewhere too ("browse all"), so the board holds it. */
  finder: {
    containerRef: RefObject<HTMLDivElement | null>;
    description: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  /** Sits under the plan in the same column: the season setup. */
  afterPlan?: React.ReactNode;
}) {
  const isWide = useIsWide();
  // What can still be entered. The suggestions list and its count draw from this, so
  // "open to enter" never lists an event whose entries have shut.
  const enterable = splitByEntryState(shortlist.ownGroup).open;
  const [showAvailable, setShowAvailable] = useState(true);
  // The list is the way in: each event there can be added to the plan. The calendar is
  // for checking clashes, so it is one click away rather than the first thing seen.
  const [view, setView] = useState<FinderView>("list");
  const [filters, setFilters] = useState<FinderFilters>(NO_FILTERS);

  const allItems = buildCalendarItems({
    shortlist,
    planEntries,
    suggestions: recommendations?.items ?? [],
    showAvailable,
    selectedSlug,
  });
  // The dialog finds its event among everything, so a filter never hides one the parent
  // opened from somewhere else. The calendar and list draw only what the filters leave.
  const selected = allItems.find((item) => item.slug === selectedSlug) ?? null;
  const items = filterItems(allItems, filters);
  const filteredShortlist = filterShortlist(shortlist, filters);
  const hasMatches =
    filteredShortlist.ownGroup.length +
      filteredShortlist.playingUp.length +
      filteredShortlist.unknown.length +
      filteredShortlist.closed.length >
    0;
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

  // A fragment, not a wrapper: the board's grid places the plan beside the rail and the
  // calendar across the full width beneath them, so a wide calendar is never squeezed
  // into the plan's column with the rail's space left empty beside it.
  return (
    <>
      {/* The plan, then the setup under it. A wrapper only so they travel together; on a
          phone each part is ordered by `order-*`. */}
      <div className="contents">
        <motion.section
          variants={BLOCK}
          aria-label="Your plan and suggestions"
          data-tour="pick"
          className="order-2 min-w-0 rounded-lg border border-slate-200 bg-white lg:order-none"
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
                upcoming={enterable.slice(0, 4)}
                openCount={enterable.length}
                reach={reach}
              />
            </TabsContent>
          </Tabs>
        </motion.section>
        {afterPlan && (
          <motion.div variants={BLOCK} className="order-4 min-w-0 lg:order-none">
            {afterPlan}
          </motion.div>
        )}
      </div>

      <div className="order-5 min-w-0 lg:order-none">
        <TournamentFinder
          containerRef={finder.containerRef}
          description={finder.description}
          open={finder.open}
          onOpenChange={finder.onOpenChange}
          isWide={isWide}
          view={view}
          onViewChange={setView}
          filters={filters}
          onFiltersChange={setFilters}
          options={filterOptions(shortlist)}
          shortlist={filteredShortlist}
          hasMatches={hasMatches}
          plannedSlugs={plannedSlugs}
          isAdding={isAdding}
          onAdd={onAdd}
          reach={reach}
          calendar={{
            items,
            blocked: preferences?.blockedRanges ?? [],
            today,
            month,
            months,
            onMonthChange: setChosenMonth,
            selectedSlug,
            onSelect: (slug) => onSelect(slug === selectedSlug ? null : slug),
            showAvailable,
            onToggleAvailable: setShowAvailable,
          }}
        />
      </div>

      <Modal
        isOpen={Boolean(selected)}
        onClose={() => onSelect(null)}
        title={selected?.name}
        size="md"
      >
        {detail}
      </Modal>
    </>
  );
}
