import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { CalendarMonthGrid } from "../CalendarMonthGrid";
import { EditionRow } from "../EditionRow";
import { savedEventKey } from "../AddToCalendarButton";
import type { SeriesGroup } from "../seriesGroups";
import { CAL_TZ, type EditionMonthBucket } from "../editionUtils";
import type { TabId } from "../federationShared";

export function CalendarTab({
  fedAcronym,
  officialCalendarUrl,
  sportLabel,
  switchTab,
  archetypeNote,
  editions,
  editionsLoading,
  editionsLoaded,
  editionsLastChecked,
  editionAgeGroup,
  setEditionAgeGroup,
  editionState,
  setEditionState,
  openSeries,
  setOpenSeries,
  setEditionDate,
  showEditionFilters,
  setShowEditionFilters,
  savedEventKeys,
  markSavedToCalendar,
  editionAgeGroupOptions,
  editionStateOptions,
  filteredEditions,
  editionMonths,
  activeMonthKey,
  setEditionMonth,
  activeMonth,
  editionFiltersActive,
  monthEditions,
  activeDate,
  visibleEditions,
  visibleSeries,
}: {
  fedAcronym: string;
  officialCalendarUrl?: string;
  sportLabel: string;
  switchTab: (tab: TabId) => void;
  archetypeNote: { calendar: string; competitions: string };
  editions: TournamentEdition[];
  editionsLoading: boolean;
  editionsLoaded: boolean;
  editionsLastChecked: string | null;
  editionAgeGroup: string;
  setEditionAgeGroup: (value: string) => void;
  editionState: string;
  setEditionState: (value: string) => void;
  openSeries: Set<string>;
  setOpenSeries: (updater: (prev: Set<string>) => Set<string>) => void;
  setEditionDate: (date: string | null) => void;
  showEditionFilters: boolean;
  setShowEditionFilters: (updater: (value: boolean) => boolean) => void;
  savedEventKeys: Set<string>;
  markSavedToCalendar: (key: string) => void;
  editionAgeGroupOptions: string[];
  editionStateOptions: string[];
  filteredEditions: TournamentEdition[];
  editionMonths: EditionMonthBucket[];
  activeMonthKey: string;
  setEditionMonth: (key: string) => void;
  activeMonth: EditionMonthBucket | undefined;
  editionFiltersActive: boolean;
  monthEditions: TournamentEdition[];
  activeDate: string | null;
  visibleEditions: TournamentEdition[];
  visibleSeries: SeriesGroup[];
}) {
  return (
    <div className="space-y-5">
      {editionsLoading && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <div className="border-power-orange inline-block h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Loading upcoming dates…</p>
        </div>
      )}

      {!editionsLoading && editionsLoaded && editions.length > 0 && (
        /* Master-detail: the grid is a fixed-width control column, the
           series list takes the rest. Collapses to stacked below lg,
           where there is no room for two columns. minmax(0,1fr) keeps a
           long tournament name from pushing the column wider than the
           track. */
        <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
          {/* ── Left: the calendar. Stretches to the detail panel's height
                 (grid items stretch by default — no items-start here) with the
                 month centred in whatever room that leaves. ── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:sticky lg:top-[63px]">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-0.5">
                <button
                  onClick={() => {
                    const i = editionMonths.findIndex((m) => m.key === activeMonthKey);
                    const prev = editionMonths[i - 1];
                    if (prev) {
                      setEditionMonth(prev.key);
                      setEditionDate(null);
                    }
                  }}
                  disabled={editionMonths.findIndex((m) => m.key === activeMonthKey) <= 0}
                  aria-label="Previous month"
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="font-title min-w-0 flex-1 truncate text-center text-[15px] font-bold tracking-tight text-slate-900">
                  {activeMonth?.fullLabel ?? "Upcoming"}
                </h3>
                <button
                  onClick={() => {
                    const i = editionMonths.findIndex((m) => m.key === activeMonthKey);
                    const next = editionMonths[i + 1];
                    if (next) {
                      setEditionMonth(next.key);
                      setEditionDate(null);
                    }
                  }}
                  disabled={
                    editionMonths.findIndex((m) => m.key === activeMonthKey) >=
                    editionMonths.length - 1
                  }
                  aria-label="Next month"
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <span className="shrink-0 text-xs font-semibold text-slate-400">
                {monthEditions.length}
              </span>
            </div>

            <CalendarMonthGrid
              monthKey={activeMonthKey}
              editions={monthEditions}
              selectedDate={activeDate}
              onSelectDate={setEditionDate}
            />
          </div>

          {/* ── Right: what is actually on ── */}
          <div className="space-y-3">
            {visibleSeries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
                <p className="text-sm font-semibold text-slate-600">
                  {editionFiltersActive
                    ? "Nothing matches these filters"
                    : "Pick a highlighted date"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {editionFiltersActive
                    ? "Try a different age group or state"
                    : "The orange dates on the left have tournaments"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span className="min-w-0 truncate text-sm font-bold text-slate-800">
                    {activeDate
                      ? new Date(activeDate).toLocaleDateString("en-IN", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          timeZone: CAL_TZ,
                        })
                      : (activeMonth?.fullLabel ?? "Upcoming")}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {visibleEditions.length} event{visibleEditions.length === 1 ? "" : "s"}
                    </span>
                    {(editionAgeGroupOptions.length > 0 || editionStateOptions.length > 1) && (
                      <button
                        onClick={() => setShowEditionFilters((v) => !v)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                          editionFiltersActive
                            ? "text-power-orange bg-orange-50"
                            : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {editionFiltersActive
                          ? [
                              editionAgeGroup !== "All" ? editionAgeGroup : null,
                              editionState !== "All" ? editionState : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "Filter"}
                      </button>
                    )}
                  </div>
                </div>

                {showEditionFilters && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 bg-slate-50 px-5 py-3">
                    {editionAgeGroupOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {["All", ...editionAgeGroupOptions].map((ag) => (
                          <button
                            key={ag}
                            onClick={() => setEditionAgeGroup(ag)}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              editionAgeGroup === ag
                                ? "bg-power-orange text-white"
                                : "hover:text-power-orange bg-white text-slate-600"
                            }`}
                          >
                            {ag}
                          </button>
                        ))}
                      </div>
                    )}
                    {editionStateOptions.length > 1 && (
                      <select
                        value={editionState}
                        onChange={(e) => setEditionState(e.target.value)}
                        className="focus:ring-power-orange/20 rounded-xl border-0 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2"
                      >
                        <option value="All">All states</option>
                        {editionStateOptions.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    )}
                    {editionFiltersActive && (
                      <button
                        onClick={() => {
                          setEditionAgeGroup("All");
                          setEditionState("All");
                        }}
                        className="hover:text-power-orange text-xs font-semibold text-slate-400 underline transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {visibleSeries.map((group) => {
                  const isOpen = openSeries.has(group.key);
                  const first = group.ageGroups[0];
                  const last = group.ageGroups[group.ageGroups.length - 1];
                  const ageSpan =
                    group.ageGroups.length > 1 ? `${first} – ${last}` : (first ?? null);
                  return (
                    <div key={group.key}>
                      <button
                        onClick={() =>
                          setOpenSeries((prev) => {
                            const next = new Set(prev);
                            if (next.has(group.key)) next.delete(group.key);
                            else next.add(group.key);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-slate-50"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform ${
                            isOpen ? "rotate-180" : "-rotate-90"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                          {group.label}
                        </span>
                        {ageSpan && (
                          <span className="hidden shrink-0 text-xs text-slate-400 sm:block">
                            {ageSpan}
                          </span>
                        )}
                        <span className="w-7 shrink-0 text-right text-sm font-bold text-slate-900">
                          {group.editions.length}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="divide-y divide-slate-50 bg-slate-50/40 py-2 pl-12 pr-5">
                          {group.editions.map((e, i) => (
                            <EditionRow
                              key={i}
                              edition={e}
                              inSeries
                              highlightAgeGroup={
                                editionAgeGroup === "All" ? undefined : editionAgeGroup
                              }
                              savedInCalendar={savedEventKeys.has(
                                savedEventKey(e.name, e.startDate)
                              )}
                              onSavedToCalendar={markSavedToCalendar}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs leading-relaxed text-slate-400">
              {archetypeNote.calendar}{" "}
              <button
                onClick={() => switchTab("tournaments")}
                className="hover:text-power-orange font-semibold text-slate-500 underline transition"
              >
                {archetypeNote.competitions}
              </button>
            </p>

            <p className="text-xs text-slate-400">
              {filteredEditions.length} confirmed {sportLabel} date
              {filteredEditions.length === 1 ? "" : "s"} through{" "}
              {new Date(
                filteredEditions[filteredEditions.length - 1]?.startDate ?? new Date().toISOString()
              ).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: CAL_TZ,
              })}
              {editionsLastChecked &&
                ` · last confirmed ${new Date(editionsLastChecked).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  timeZone: CAL_TZ,
                })}`}
              {officialCalendarUrl && (
                <>
                  {" · "}
                  <a
                    href={officialCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-power-orange font-semibold text-slate-500 underline transition"
                  >
                    official calendar
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {!editionsLoading && editionsLoaded && editions.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No confirmed dates published yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
            We haven&apos;t curated official {fedAcronym} tournament dates for this sport yet.
            {officialCalendarUrl && " Check the official calendar in the meantime."}
          </p>
          {officialCalendarUrl && (
            <a
              href={officialCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:border-power-orange hover:text-power-orange mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition"
            >
              <ExternalLink className="h-4 w-4" />
              View Official Calendar
            </a>
          )}
        </div>
      )}

      {!editionsLoaded && !editionsLoading && (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-500">Tournament dates are loading…</p>
        </div>
      )}
    </div>
  );
}
