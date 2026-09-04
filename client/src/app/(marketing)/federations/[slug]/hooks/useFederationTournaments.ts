import { useEffect, useState } from "react";
import type { Tournament } from "@/modules/pathway/services/pathway";
import { federationApi } from "@/modules/pathway/services/pathway";
import { availableLevelFilters, levelMatches, type TabId } from "../federationShared";

/** The Tournaments tab's data fetch, filters, and derived list. Lazy-loaded on
 *  first visit to the tab, same as useFederationCalendar's editions fetch. */
export function useFederationTournaments(slug: string, activeTab: TabId) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false);
  const [tournamentTotal, setTournamentTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [tournamentSearch, setTournamentSearch] = useState("");

  // Load tournaments lazily when tab is first opened
  useEffect(() => {
    if (activeTab !== "tournaments" || tournamentsLoaded) return;
    setTournamentsLoading(true);
    federationApi
      .getTournaments(slug, { limit: 50 })
      .then((data) => {
        if (data) {
          setTournaments(data.tournaments);
          setTournamentTotal(data.pagination.total);
        }
        setTournamentsLoaded(true);
      })
      .catch(() => setTournamentsLoaded(true))
      .finally(() => setTournamentsLoading(false));
  }, [activeTab, slug, tournamentsLoaded]);

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
