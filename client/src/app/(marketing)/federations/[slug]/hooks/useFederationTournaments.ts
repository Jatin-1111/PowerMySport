import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { federationApi } from "@/modules/pathway/services/pathway";
import { availableLevelFilters, levelMatches, type TabId } from "../federationShared";

/** The Tournaments tab's data fetch, filters, and derived list. Lazy-loaded on
 *  first visit to the tab, same as useFederationCalendar's editions fetch. */
export function useFederationTournaments(slug: string, activeTab: TabId) {
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [tournamentSearch, setTournamentSearch] = useState("");

  // Load tournaments lazily when tab is first opened. `getTournaments` never
  // rejects (it swallows its own errors and resolves null), so `isSuccess`
  // after settling covers both the ok and failed case — same as the old
  // `tournamentsLoaded` flag, which was set in both the `.then` and `.catch`.
  const query = useQuery({
    queryKey: queryKeys.federations.tournaments(slug),
    queryFn: () => federationApi.getTournaments(slug, { limit: 50 }),
    enabled: activeTab === "tournaments",
  });

  const tournaments = query.data?.tournaments ?? [];
  const tournamentTotal = query.data?.pagination.total ?? 0;
  const tournamentsLoading = query.isFetching;
  const tournamentsLoaded = query.isSuccess || query.isError;

  // Only offer pills the data can satisfy, and only when there's a real choice
  // to make — a lone "All / National" pair filters nothing.
  const levelFilterOptions = availableLevelFilters(tournaments);
  const showLevelFilters = levelFilterOptions.length >= 2;
  // If the active pill isn't offered (data changed, or filters just collapsed),
  // fall back to "All" rather than silently showing an empty list.
  const activeLevelFilter =
    levelFilter === "All" || levelFilterOptions.includes(levelFilter) ? levelFilter : "All";

  const filteredTournaments = tournaments.filter((t) => {
    if (activeLevelFilter !== "All" && !levelMatches(t.level, activeLevelFilter)) return false;
    if (ageGroupFilter && !t.ageGroup?.toLowerCase().includes(ageGroupFilter.toLowerCase()))
      return false;
    if (tournamentSearch && !t.name.toLowerCase().includes(tournamentSearch.toLowerCase()))
      return false;
    return true;
  });

  return {
    tournaments,
    tournamentsLoading,
    tournamentsLoaded,
    tournamentTotal,
    levelFilter,
    setLevelFilter,
    ageGroupFilter,
    setAgeGroupFilter,
    tournamentSearch,
    setTournamentSearch,
    levelFilterOptions,
    showLevelFilters,
    activeLevelFilter,
    filteredTournaments,
  };
}
