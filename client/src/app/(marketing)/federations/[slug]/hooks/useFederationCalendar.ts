import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { federationApi } from "@/modules/pathway/services/pathway";
import { calendarApi } from "@/modules/booking/services/calendarApi";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { savedEventKey } from "../AddToCalendarButton";
import { groupEditionsBySeries } from "../seriesGroups";
import { stateForCity } from "@/modules/sports/config/indianCityStates";
import { ageGroupRank, bucketEditionsByMonth, dateKey, monthKeyOf } from "../editionUtils";
import type { TabId } from "../federationShared";

/** The Calendar tab's data fetch, month/day navigation, filters, and the
 *  reader's own saved-to-calendar state. Lazy-loaded on first visit to the
 *  tab, same as useFederationTournaments' tournaments fetch. */
export function useFederationCalendar(slug: string, activeTab: TabId) {
  /** "YYYY-MM"; "" means auto — the soonest month that has events. */
  const [editionMonth, setEditionMonth] = useState("");
  const [editionAgeGroup, setEditionAgeGroup] = useState("All");
  /** Filters by state, not city: exact-city is far too narrow (Under-14 in Delhi is 3 events). */
  const [editionState, setEditionState] = useState("All");
  /** Series card keys the reader has opened. Collapsed by default — the point is a short list. */
  const [openSeries, setOpenSeries] = useState<Set<string>>(new Set());
  /** "YYYY-MM-DD" when a day is picked in the grid; null means the whole month. */
  const [editionDate, setEditionDate] = useState<string | null>(null);
  /** Refinements stay folded away by default — they are secondary to the calendar. */
  const [showEditionFilters, setShowEditionFilters] = useState(false);
  /** Keys marked saved this session, ahead of the saved-events query noticing —
   *  see markSavedToCalendar below. */
  const [locallyMarkedKeys, setLocallyMarkedKeys] = useState<Set<string>>(new Set());

  const user = useAuthStore((state) => state.user);

  // Load calendar editions lazily when tab is first opened. `getEditions`
  // never rejects (it swallows its own errors and resolves null), so
  // `isSuccess` after settling covers both the ok and failed case — same as
  // the old `editionsLoaded` flag, which was set in both the `.then` and
  // `.catch`.
  const editionsQuery = useQuery({
    queryKey: queryKeys.federations.editions(slug),
    queryFn: () => federationApi.getEditions(slug, { limit: 400 }),
    enabled: activeTab === "calendar",
  });

  const editions = useMemo(() => editionsQuery.data?.editions ?? [], [editionsQuery.data]);
  const editionsLastChecked = editionsQuery.data?.lastCheckedAt ?? null;
  const editionsLoading = editionsQuery.isFetching;
  const editionsLoaded = editionsQuery.isSuccess || editionsQuery.isError;

  /**
   * Tournaments this reader already keeps in their own calendar.
   *
   * Fetched once for the span the editions cover, so a row shows as saved after
   * a reload instead of only within the session that added it — without this
   * the same date is silently addable over and over. Logged-out readers skip it
   * entirely; the button sends them to login instead.
   */
  const dateRange = useMemo(() => {
    if (editions.length === 0) return null;
    const dates = editions.map((e) => new Date(e.startDate).getTime());
    return {
      from: new Date(Math.min(...dates)).toISOString().slice(0, 10),
      to: new Date(Math.max(...dates)).toISOString().slice(0, 10),
    };
  }, [editions]);

  const savedEventsQuery = useQuery({
    queryKey: queryKeys.federations.savedEvents(slug, dateRange?.from ?? "", dateRange?.to ?? ""),
    queryFn: () => calendarApi.getEvents(dateRange!.from, dateRange!.to),
    enabled: activeTab === "calendar" && !!user && !!dateRange,
  });

  // A save elsewhere on the page (AddToCalendarButton) doesn't refetch this
  // query — it just needs the button to flip to "saved" immediately, so the
  // key is tracked locally and unioned with whatever the query already knows.
  const markSavedToCalendar = useCallback((key: string) => {
    setLocallyMarkedKeys((prev) => new Set(prev).add(key));
  }, []);

  const savedEventKeys = useMemo(() => {
    const fromQuery = (savedEventsQuery.data ?? [])
      .filter((ev) => ev.type === "COMPETITION")
      .map((ev) => savedEventKey(ev.title, ev.date));
    return new Set([...fromQuery, ...locallyMarkedKeys]);
  }, [savedEventsQuery.data, locallyMarkedKeys]);

  // ── Calendar navigation (filters drive the month counts, so they stay honest) ──
  const editionAgeGroupOptions = Array.from(
    new Set(editions.flatMap((e) => e.ageGroups ?? []))
  ).sort((a, b) => ageGroupRank(a) - ageGroupRank(b) || a.localeCompare(b));

  const editionStateOptions = Array.from(
    new Set(editions.map((e) => stateForCity(e.city)).filter((s): s is string => !!s))
  ).sort((a, b) => a.localeCompare(b));

  const filteredEditions = editions.filter((e) => {
    if (editionAgeGroup !== "All" && !(e.ageGroups ?? []).includes(editionAgeGroup)) return false;
    if (editionState !== "All" && stateForCity(e.city) !== editionState) return false;
    return true;
  });

  /**
   * Month navigation is built from ALL editions, not the filtered set. Deriving
   * it from filtered data made the calendar and the month stepper vanish
   * entirely whenever a filter matched nothing, stranding the reader with no
   * control to undo it. The filters belong on the counts and the detail panel,
   * not on the furniture used to navigate.
   */
  const editionMonths = bucketEditionsByMonth(editions);
  const activeMonthKey = editionMonths.some((m) => m.key === editionMonth)
    ? editionMonth
    : (editionMonths[0]?.key ?? "");
  const activeMonth = editionMonths.find((m) => m.key === activeMonthKey);
  const editionFiltersActive = editionAgeGroup !== "All" || editionState !== "All";
  /** Editions of the month in view (filtered), before the grid's day selection. */
  const monthEditions = filteredEditions.filter((e) => monthKeyOf(e.startDate) === activeMonthKey);
  const monthDateKeys = [...new Set(monthEditions.map((e) => dateKey(e.startDate)))].sort();
  /**
   * The detail panel is always about one date, never a whole-month aggregate.
   * Falls back to the soonest date in the month, which also handles switching
   * month (the previous month's date is no longer in range) without an effect.
   */
  const activeDate =
    editionDate && monthDateKeys.includes(editionDate) ? editionDate : (monthDateKeys[0] ?? null);
  const visibleEditions = activeDate
    ? monthEditions.filter((e) => dateKey(e.startDate) === activeDate)
    : [];
  const visibleSeries = groupEditionsBySeries(visibleEditions);

  return {
    editions,
    editionsLoading,
    editionsLoaded,
    editionsLastChecked,
    editionMonth,
    setEditionMonth,
    editionAgeGroup,
    setEditionAgeGroup,
    editionState,
    setEditionState,
    openSeries,
    setOpenSeries,
    editionDate,
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
    activeMonth,
    editionFiltersActive,
    monthEditions,
    activeDate,
    visibleEditions,
    visibleSeries,
  };
}
