import { ArrowRight, CalendarDays, Search, Trophy, Users } from "lucide-react";
import type { Tournament } from "@/modules/pathway/services/pathway";
import { levelColor } from "../editionUtils";
import type { TabId } from "../federationShared";

export function TournamentsTab({
  sportLabel,
  switchTab,
  tournamentsLoading,
  tournamentsLoaded,
  tournamentTotal,
  levelFilter: activeLevelFilter,
  setLevelFilter,
  ageGroupFilter,
  setAgeGroupFilter,
  tournamentSearch,
  setTournamentSearch,
  levelFilterOptions,
  showLevelFilters,
  filteredTournaments,
  editionsLoaded,
  editionsCount,
}: {
  sportLabel: string;
  switchTab: (tab: TabId) => void;
  tournamentsLoading: boolean;
  tournamentsLoaded: boolean;
  tournamentTotal: number;
  levelFilter: string;
  setLevelFilter: (level: string) => void;
  ageGroupFilter: string;
  setAgeGroupFilter: (value: string) => void;
  tournamentSearch: string;
  setTournamentSearch: (value: string) => void;
  levelFilterOptions: string[];
  showLevelFilters: boolean;
  filteredTournaments: Tournament[];
  editionsLoaded: boolean;
  editionsCount: number;
}) {
  return (
    <div id="tournaments" className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tournaments…"
            value={tournamentSearch}
            onChange={(e) => setTournamentSearch(e.target.value)}
            className="focus:ring-power-orange/20 focus:border-power-orange w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2"
          />
        </div>
        {/* Age group */}
        <input
          type="text"
          placeholder="Age group (e.g. U-14)…"
          value={ageGroupFilter}
          onChange={(e) => setAgeGroupFilter(e.target.value)}
          className="focus:ring-power-orange/20 focus:border-power-orange w-48 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2"
        />
        {/* Level pills — omitted entirely when the data offers no real choice */}
        {showLevelFilters && (
          <div className="flex flex-wrap gap-1.5">
            {["All", ...levelFilterOptions].map((l) => (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  activeLevelFilter === l
                    ? "bg-power-orange border-power-orange text-white"
                    : "hover:text-power-orange border-slate-200 bg-white text-slate-600 hover:border-orange-200"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Count + cross-link into the dated calendar. These tabs answer
          different questions — this tab is the evergreen "what is this and
          how do I enter", the Calendar is "when and where" — so each needs
          a route to the other. The count only shows once the Calendar tab
          has been opened; it stays lazy rather than fetching eagerly. */}
      {tournamentsLoaded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Showing {filteredTournaments.length} of {tournamentTotal} tournaments
          </p>
          <button
            onClick={() => switchTab("calendar")}
            className="text-power-orange inline-flex items-center gap-1.5 text-xs font-semibold transition hover:text-orange-600"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {editionsLoaded && editionsCount > 0
              ? `${editionsCount} upcoming ${sportLabel} dates`
              : "See upcoming dates"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Loading */}
      {tournamentsLoading && (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <div className="border-power-orange inline-block h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Loading tournaments…</p>
        </div>
      )}

      {/* Grid */}
      {!tournamentsLoading && tournamentsLoaded && filteredTournaments.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTournaments.map((t, i) => {
            const lc = levelColor(t.level);
            return (
              // Not a link: there is no tournament detail page. Everything
              // a parent gets is on the card, so hover-lift and a trailing
              // arrow would promise a destination that doesn't exist.
              <div
                key={i}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="from-power-orange h-[3px] w-full bg-gradient-to-r to-amber-400" />
                <div className="flex flex-col p-4" style={{ minHeight: "130px" }}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${lc.pill}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${lc.dot}`} />
                      {t.level}
                    </span>
                  </div>
                  <p className="font-title line-clamp-2 flex-1 text-sm font-bold leading-snug text-slate-900">
                    {t.name}
                  </p>
                  {t.ageGroup && (
                    <div className="mt-3 flex min-w-0 items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-400">
                      <Users className="h-3 w-3 shrink-0" />
                      <span className="truncate">{t.ageGroup}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!tournamentsLoading && tournamentsLoaded && filteredTournaments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">No tournaments match these filters</p>
          <p className="mt-1 text-xs text-slate-400">Try clearing the filters above</p>
        </div>
      )}

      {!tournamentsLoaded && !tournamentsLoading && (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
          <p className="text-sm text-slate-500">Tournament data is loading…</p>
        </div>
      )}
    </div>
  );
}
