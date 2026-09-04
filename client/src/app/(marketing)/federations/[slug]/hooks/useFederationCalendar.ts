import { useCallback, useEffect, useState } from "react";
import type { TournamentEdition } from "@/modules/pathway/services/pathway";
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
  const [editions, setEditions] = useState<TournamentEdition[]>([]);
  const [editionsLoading, setEditionsLoading] = useState(false);
  const [editionsLoaded, setEditionsLoaded] = useState(false);
  const [editionsLastChecked, setEditionsLastChecked] = useState<string | null>(null);
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
  /** `title|YYYY-MM-DD` for each edition already in this reader's own calendar. */
  const [savedEventKeys, setSavedEventKeys] = useState<Set<string>>(new Set());
  const [savedEventsLoaded, setSavedEventsLoaded] = useState(false);

  const user = useAuthStore((state) => state.user);

  // Load calendar editions lazily when tab is first opened
  useEffect(() => {
    if (activeTab !== "calendar" || editionsLoaded) return;
    setEditionsLoading(true);
    federationApi
      .getEditions(slug, { limit: 400 })
      .then((data) => {
        if (data) {
          setEditions(data.editions);
          setEditionsLastChecked(data.lastCheckedAt);
        }
        setEditionsLoaded(true);
      })
      .catch(() => setEditionsLoaded(true))
      .finally(() => setEditionsLoading(false));
  }, [activeTab, slug, editionsLoaded]);

  /**
   * Tournaments this reader already keeps in their own calendar.
   *
   * Fetched once for the span the editions cover, so a row shows as saved after
   * a reload instead of only within the session that added it — without this
   * the same date is silently addable over and over. Logged-out readers skip it
   * entirely; the button sends them to login instead.
   */
  useEffect(() => {
    if (activeTab !== "calendar" || !user || editions.length === 0 || savedEventsLoaded) return;
    const dates = editions.map((e) => new Date(e.startDate).getTime());
    setSavedEventsLoaded(true);
    calendarApi
      .getEvents(
        new Date(Math.min(...dates)).toISOString().slice(0, 10),
        new Date(Math.max(...dates)).toISOString().slice(0, 10)
      )
      .then((events) =>
        setSavedEventKeys(
          new Set(
            events
              .filter((ev) => ev.type === "COMPETITION")
              .map((ev) => savedEventKey(ev.title, ev.date))
          )
        )
      )
      // A failed lookup only costs the saved-state badge, so leave the tab usable.
      .catch(() => undefined);
  }, [activeTab, user, editions, savedEventsLoaded]);

  const markSavedToCalendar = useCallback((key: string) => {
    setSavedEventKeys((prev) => new Set(prev).add(key));
  }, []);

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
