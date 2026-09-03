"use client";

import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  CheckCircle2,
} from "lucide-react";
import { BackToRoadmapLink } from "@/modules/pathway/components/BackToRoadmapLink";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useEffect, useRef, useState, useCallback } from "react";
import type { FederationDetail } from "./page";
import type { Tournament, TournamentEdition } from "@/modules/pathway/services/pathway";
import { federationApi } from "@/modules/pathway/services/pathway";
import { getSportArchetypeInfo } from "@/modules/sports/config/sportArchetypes";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { EditionRow } from "./EditionRow";
import { savedEventKey } from "./AddToCalendarButton";
import { calendarApi } from "@/modules/booking/services/calendarApi";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { groupEditionsBySeries } from "./seriesGroups";
import { stateForCity } from "@/modules/sports/config/indianCityStates";
import {
  CAL_TZ,
  ageGroupRank,
  bucketEditionsByMonth,
  dateKey,
  levelColor,
  monthKeyOf,
} from "./editionUtils";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPORT_LABEL: Record<string, string> = {
  cricket: "Cricket",
  tennis: "Tennis",
  chess: "Chess",
  football: "Football",
  basketball: "Basketball",
  hockey: "Hockey",
  "table-tennis": "Table Tennis",
  swimming: "Swimming",
  badminton: "Badminton",
  volleyball: "Volleyball",
};

const TYPE_META = {
  govt: {
    label: "Government Body",
    bg: "bg-blue-500/20",
    text: "text-blue-200",
    border: "border-blue-400/30",
  },
  national: {
    label: "National Federation",
    bg: "bg-emerald-500/20",
    text: "text-emerald-200",
    border: "border-emerald-400/30",
  },
  hybrid: {
    label: "Public-Private Body",
    bg: "bg-violet-500/20",
    text: "text-violet-200",
    border: "border-violet-400/30",
  },
} as const;

const TABS = [
  { id: "overview", label: "Overview", icon: Globe },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "eligibility", label: "Eligibility", icon: Users },
  { id: "register", label: "How to Register", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * Candidate level pills, widest scope first. These are only ever *offered* when
 * the loaded tournaments actually contain them — a fixed list shipped dead
 * options: "District" and "Zonal" matched zero records anywhere in the database,
 * and for ranking/rating sports they don't exist as a concept at all (see
 * sportArchetypes.ts).
 */
const LEVEL_FILTER_CANDIDATES = [
  "International",
  "National",
  "State",
  "District",
  "Zonal",
] as const;

/**
 * Word-boundary match, NOT substring: "International".includes("national") is
 * true, so a plain substring test made the National pill select every
 * International event too. Still tolerates the free-form values scraped records
 * carry — "National (School)", "Grassroots / National" — and correctly reports
 * "National/International" as both.
 */
function levelMatches(level: string | undefined, candidate: string): boolean {
  return !!level && new RegExp(`\\b${candidate}\\b`, "i").test(level);
}

function availableLevelFilters(list: Tournament[]): string[] {
  return LEVEL_FILTER_CANDIDATES.filter((candidate) =>
    list.some((t) => levelMatches(t.level, candidate))
  );
}

/**
 * How the two tabs describe each other, per sport archetype.
 *
 * Archetypes exist precisely because competitive structure isn't universal (see
 * sportArchetypes.ts) — a ranking sport has no district/state ladder, so the
 * calendar can't be framed as "events at your level". Each archetype gets copy
 * that matches how progression actually works, and points at the tab that
 * explains it.
 */
const ARCHETYPE_CALENDAR_NOTE: Record<
  ReturnType<typeof getSportArchetypeInfo>["archetype"],
  { calendar: string; competitions: string }
> = {
  ranking: {
    calendar:
      "These are ranking-circuit events — entering them is how a player earns the points that build a national ranking. The tier of each event decides how many points are on offer.",
    competitions: "See how the ranking tiers fit together",
  },
  rating: {
    calendar:
      "These are rated events — results from them move a player's official rating, which is what determines entry to higher tiers.",
    competitions: "See how the rating milestones work",
  },
  federation: {
    calendar:
      "These are the dated events on this federation's calendar. Selection runs through district and state representation before the national level.",
    competitions: "See the selection pathway",
  },
  standard: {
    calendar:
      "These are the dated meets on this federation's calendar — each is a chance to post a time or score against the published qualifying standards.",
    competitions: "See the qualifying standards",
  },
};

// ─── Main client component ────────────────────────────────────────────────────

export function FederationDetailClient({
  federation: fed,
  initialTab = "overview",
  hasPathway = false,
}: {
  federation: FederationDetail;
  initialTab?: TabId;
  /** Whether this federation's sport has a published pathway — resolved server-side. */
  hasPathway?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Tournaments tab state
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsLoaded, setTournamentsLoaded] = useState(false);
  const [tournamentTotal, setTournamentTotal] = useState(0);
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [tournamentSearch, setTournamentSearch] = useState("");

  // Calendar tab state
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

  const sportLabel = SPORT_LABEL[fed.sportSlug] ?? fed.sportSlug;
  const typeMeta = TYPE_META[fed.type];
  const isVerified = !!fed.dataVerifiedAt;
  const archetype = getSportArchetypeInfo(fed.sportSlug).archetype;
  const archetypeNote = ARCHETYPE_CALENDAR_NOTE[archetype];

  const switchTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    // Scroll tab bar into view on mobile
    if (tabBarRef.current) {
      tabBarRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  // Load tournaments lazily when tab is first opened
  useEffect(() => {
    if (activeTab !== "tournaments" || tournamentsLoaded) return;
    setTournamentsLoading(true);
    federationApi
      .getTournaments(fed.slug, { limit: 50 })
      .then((data) => {
        if (data) {
          setTournaments(data.tournaments);
          setTournamentTotal(data.pagination.total);
        }
        setTournamentsLoaded(true);
      })
      .catch(() => setTournamentsLoaded(true))
      .finally(() => setTournamentsLoading(false));
  }, [activeTab, fed.slug, tournamentsLoaded]);

  // Load calendar editions lazily when tab is first opened
  useEffect(() => {
    if (activeTab !== "calendar" || editionsLoaded) return;
    setEditionsLoading(true);
    federationApi
      .getEditions(fed.slug, { limit: 400 })
      .then((data) => {
        if (data) {
          setEditions(data.editions);
          setEditionsLastChecked(data.lastCheckedAt);
        }
        setEditionsLoaded(true);
      })
      .catch(() => setEditionsLoaded(true))
      .finally(() => setEditionsLoading(false));
  }, [activeTab, fed.slug, editionsLoaded]);

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

  return (
    <main className="min-h-screen">
      {/* ── Hero ── */}
      <div className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="border-b border-white/[0.07] pb-4 pt-5">
            <BackToRoadmapLink sportSlug={fed.sportSlug} hasPathway={hasPathway} />
          </div>

          {/* Header content */}
          <div className="pb-9 pt-7">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border}`}
              >
                <Landmark className="h-3 w-3" />
                {typeMeta.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.07] px-3 py-1 text-[11px] font-semibold text-white/50">
                <Globe className="h-3 w-3" />
                {sportLabel}
              </span>
              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/[0.1] px-3 py-1 text-[11px] font-bold text-emerald-400">
                  <BadgeCheck className="h-3 w-3" />
                  Data Verified
                </span>
              )}
            </div>

            <div className="flex items-start gap-5">
              {/* Monogram */}
              <div className="hidden h-[72px] w-[72px] shrink-0 select-none items-center justify-center rounded-2xl bg-white/[0.08] text-2xl font-black tracking-tight text-white sm:flex">
                {fed.acronym.slice(0, 2)}
              </div>
              <div>
                <h1 className="font-title text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
                  {fed.acronym}
                </h1>
                <p className="mt-2 text-base font-medium text-white/50">{fed.name}</p>
                {fed.headquarters && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-white/30">
                    <MapPin className="h-3.5 w-3.5" />
                    {fed.headquarters}
                    {fed.founded && ` · Est. ${fed.founded}`}
                  </p>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              {fed.website && (
                <a
                  href={fed.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow transition hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Official Website
                </a>
              )}
              {fed.officialCalendarUrl && (
                <a
                  href={fed.officialCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.15] bg-white/[0.07] px-5 py-2.5 text-sm font-bold text-white/75 transition hover:bg-white/[0.14] hover:text-white"
                >
                  <Calendar className="h-4 w-4" />
                  Tournament Calendar
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky tab bar ── */}
      <div
        ref={tabBarRef}
        className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="scrollbar-none flex gap-0 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === id
                    ? "border-power-orange text-power-orange"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* ── Overview tab ── */}
        {activeTab === "overview" && (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              {/* About */}
              <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                <SectionHeading>About {fed.acronym}</SectionHeading>
                <p className="text-[15px] leading-[1.85] text-slate-600">{fed.about}</p>
              </section>

              {/* Key Facts */}
              {fed.keyFacts && fed.keyFacts.length > 0 && (
                <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                  <SectionHeading>Key Facts</SectionHeading>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fed.keyFacts.map((fact, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3.5"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <p className="text-sm leading-snug text-slate-700">{fact}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Affiliations */}
              {fed.affiliations && fed.affiliations.length > 0 && (
                <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                  <SectionHeading>International Affiliations</SectionHeading>
                  <div className="flex flex-wrap gap-2">
                    {fed.affiliations.map((aff, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm font-medium text-slate-700"
                      >
                        {aff}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* State Associations */}
              {fed.stateAssociations && fed.stateAssociations.length > 0 && (
                <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                  <SectionHeading>State Associations</SectionHeading>
                  <p className="mb-5 text-sm text-slate-500">
                    Your child must register with the state association for your state before
                    participating in national events.
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {fed.stateAssociations.map((sa, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold leading-tight text-slate-800">
                            {sa.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">{sa.state}</p>
                        </div>
                        {sa.website && (
                          <a
                            href={sa.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-power-orange shrink-0 text-slate-400 transition"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Data source notice */}
              {isVerified && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">
                      Data verified by PowerMySport
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-700">
                      This federation profile was manually cross-checked against official sources on{" "}
                      {new Date(fed.dataVerifiedAt!).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      .
                      {fed.sourceUrls?.[0] && (
                        <>
                          {" "}
                          Primary source:{" "}
                          <a
                            href={fed.sourceUrls[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium underline"
                          >
                            {new URL(fed.sourceUrls[0]).hostname}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-4 lg:sticky lg:top-20">
              {/* Quick nav */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  In this guide
                </p>
                <div className="space-y-1.5">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => switchTab(id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                        activeTab === id
                          ? "text-power-orange bg-orange-50"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                      <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-40" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact */}
              {(fed.contact?.email || fed.contact?.phone || fed.contact?.address) && (
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Contact
                  </p>
                  {fed.contact.email && (
                    <a
                      href={`mailto:${fed.contact.email}`}
                      className="hover:text-power-orange flex items-start gap-2.5 text-sm text-slate-600 transition"
                    >
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      {fed.contact.email}
                    </a>
                  )}
                  {fed.contact.phone && (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                      {fed.contact.phone}
                    </div>
                  )}
                  {fed.contact.address && (
                    <div className="flex items-start gap-2.5 text-sm text-slate-600">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="leading-snug">{fed.contact.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5">
                <div className="bg-power-orange/[0.12] pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Sparkles className="text-power-orange h-3.5 w-3.5" />
                    <p className="text-power-orange text-[10px] font-bold uppercase tracking-[0.13em]">
                      Concierge
                    </p>
                  </div>
                  <p className="mb-1.5 text-[15px] font-bold leading-snug text-white">
                    We handle registration for you
                  </p>
                  <p className="mb-4 text-xs leading-relaxed text-white/45">
                    Federation IDs, documents, form submissions — our team takes care of everything
                    at no cost.
                  </p>
                  <a
                    href={buildWhatsAppUrl(
                      `Hi! I'd like help with ${fed.acronym} registration for ${sportLabel} — found via PowerMySport.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-power-orange flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition hover:bg-orange-500"
                  >
                    <WhatsAppIcon className="h-4 w-4 text-white" />
                    Get Help via WhatsApp
                  </a>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ── Tournaments tab ── */}
        {activeTab === "tournaments" && (
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
                  {editionsLoaded && editions.length > 0
                    ? `${editions.length} upcoming ${sportLabel} dates`
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
                <p className="text-sm font-semibold text-slate-600">
                  No tournaments match these filters
                </p>
                <p className="mt-1 text-xs text-slate-400">Try clearing the filters above</p>
              </div>
            )}

            {!tournamentsLoaded && !tournamentsLoading && (
              <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
                <p className="text-sm text-slate-500">Tournament data is loading…</p>
              </div>
            )}
          </div>
        )}

        {/* ── Calendar tab ── */}
        {activeTab === "calendar" && (
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
                          {(editionAgeGroupOptions.length > 0 ||
                            editionStateOptions.length > 1) && (
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
                      filteredEditions[filteredEditions.length - 1]?.startDate ??
                        new Date().toISOString()
                    ).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: CAL_TZ,
                    })}
                    {editionsLastChecked &&
                      ` · last confirmed ${new Date(editionsLastChecked).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          timeZone: CAL_TZ,
                        }
                      )}`}
                    {fed.officialCalendarUrl && (
                      <>
                        {" · "}
                        <a
                          href={fed.officialCalendarUrl}
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
                <p className="text-sm font-semibold text-slate-600">
                  No confirmed dates published yet
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
                  We haven&apos;t curated official {fed.acronym} tournament dates for this sport
                  yet.
                  {fed.officialCalendarUrl && " Check the official calendar in the meantime."}
                </p>
                {fed.officialCalendarUrl && (
                  <a
                    href={fed.officialCalendarUrl}
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
        )}

        {/* ── Eligibility tab ── */}
        {activeTab === "eligibility" && (
          <div className="space-y-6">
            {fed.eligibilityCriteria ? (
              <>
                {/* Age cutoff rule */}
                {fed.eligibilityCriteria.ageCutoffRule && (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-bold text-amber-900">Age Cut-off Rule</p>
                        <p className="text-sm leading-relaxed text-amber-800">
                          {fed.eligibilityCriteria.ageCutoffRule}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Category table */}
                {fed.eligibilityCriteria.categories.length > 0 && (
                  <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                    <SectionHeading>Age Categories</SectionHeading>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                              Category
                            </th>
                            <th className="py-3 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                              Max Age
                            </th>
                            <th className="py-3 pr-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                              Genders
                            </th>
                            <th className="py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                              Notes
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {fed.eligibilityCriteria.categories.map((cat, i) => (
                            <tr key={i} className="transition-colors hover:bg-slate-50/50">
                              <td className="py-3.5 pr-4 font-bold text-slate-900">{cat.name}</td>
                              <td className="py-3.5 pr-4 text-slate-600">
                                {cat.maxAge === 99 ? "No limit" : `Under ${cat.maxAge}`}
                              </td>
                              <td className="py-3.5 pr-4">
                                <div className="flex flex-wrap gap-1">
                                  {cat.genders.map((g) => (
                                    <span
                                      key={g}
                                      className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                                    >
                                      {g}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="max-w-[280px] py-3.5 text-xs leading-relaxed text-slate-500">
                                {cat.notes ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Registration requirements */}
                <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                  <SectionHeading>Registration Requirements</SectionHeading>
                  <div className="mb-5 grid gap-3 sm:grid-cols-2">
                    <RequirementPill
                      label="Federation registration mandatory"
                      active={fed.eligibilityCriteria.registrationRequired}
                    />
                    <RequirementPill
                      label="State association registration first"
                      active={fed.eligibilityCriteria.stateAssociationFirst}
                    />
                  </div>
                  {fed.eligibilityCriteria.notes && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="flex items-start gap-2.5">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        <p className="text-sm leading-relaxed text-slate-600">
                          {fed.eligibilityCriteria.notes}
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Source notice */}
                {isVerified && fed.sourceUrls && fed.sourceUrls.length > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="mb-1 text-sm font-semibold text-emerald-800">
                        Verified eligibility data
                      </p>
                      <p className="text-xs leading-relaxed text-emerald-700">
                        This eligibility information was cross-checked against the official{" "}
                        {fed.acronym} rulebook and tournament circulars. Always confirm the exact
                        cutoff dates in the official tournament circular before entering.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[...new Set(fed.sourceUrls)].map((url, i) => {
                          let hostname = url;
                          try {
                            hostname = new URL(url).hostname;
                          } catch {}
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline transition hover:text-emerald-900"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {hostname}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
                <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Eligibility data coming soon</p>
                <p className="mt-1 text-xs text-slate-400">
                  We&apos;re verifying this information against official {fed.acronym} sources.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── How to Register tab ── */}
        {activeTab === "register" && (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              {/* Steps */}
              {fed.registrationSteps && fed.registrationSteps.length > 0 ? (
                <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                  <SectionHeading>Step-by-Step Registration</SectionHeading>
                  <p className="mb-8 text-sm text-slate-400">
                    Follow these steps in order. Starting early gives your child a significant
                    advantage — many spots fill fast.
                  </p>
                  <ol className="space-y-6">
                    {fed.registrationSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-5">
                        <span className="bg-power-orange/10 border-power-orange/20 text-power-orange flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold">
                          {i + 1}
                        </span>
                        <p className="flex-1 pt-1 text-[15px] leading-relaxed text-slate-700">
                          {step}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                  Registration steps not yet available for this federation.
                </div>
              )}

              {/* Required documents */}
              {fed.requiredDocuments && fed.requiredDocuments.length > 0 && (
                <section className="rounded-2xl border border-slate-100 bg-white p-7 shadow-sm sm:p-8">
                  <SectionHeading>Required Documents</SectionHeading>
                  <p className="mb-6 text-sm text-slate-400">
                    Prepare these before the tournament entry deadline — missing documents result in
                    rejection.
                  </p>
                  <ul className="space-y-3">
                    {fed.requiredDocuments.map((doc, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300">
                          <FileText className="h-3 w-3 text-slate-400" />
                        </div>
                        <span className="text-[14px] leading-snug text-slate-700">{doc}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Sidebar — Concierge */}
            <aside className="space-y-4 lg:sticky lg:top-20">
              <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-6">
                <div className="bg-power-orange/[0.12] pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-2xl" />
                <div className="bg-power-orange/[0.07] pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full blur-2xl" />
                <div className="relative z-10">
                  <div className="mb-3 flex items-center gap-1.5">
                    <Sparkles className="text-power-orange h-3.5 w-3.5" />
                    <p className="text-power-orange text-[10px] font-bold uppercase tracking-[0.13em]">
                      PowerMySport Concierge
                    </p>
                  </div>
                  <h3 className="font-title mb-2 text-[17px] font-bold leading-snug text-white">
                    We handle registration for you
                  </h3>
                  <p className="mb-5 text-[13px] leading-relaxed text-white/50">
                    Federation IDs, documents, form submissions — our team takes care of all of it.
                    At no cost.
                  </p>
                  <ul className="mb-5 space-y-2">
                    {[
                      `Get your child's ${fed.acronym} number`,
                      "Prepare and submit all required documents",
                      "Monitor deadlines and confirm your entry",
                    ].map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="text-[12px] text-white/60">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={buildWhatsAppUrl(
                      `Hi! I'd like help with ${fed.acronym} registration for ${sportLabel} — found via PowerMySport.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-power-orange flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-orange-900/30 transition hover:bg-orange-500"
                  >
                    <WhatsAppIcon className="h-4 w-4 text-white" />
                    Get Help via WhatsApp
                  </a>
                  {fed.website && (
                    <a
                      href={fed.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white/35 transition hover:text-white/65"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Official {fed.acronym} Portal
                    </a>
                  )}
                </div>
              </div>

              {/* Quick facts */}
              {fed.eligibilityCriteria && (
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Quick reference
                  </p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2.5">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="leading-snug text-slate-600">
                        {fed.eligibilityCriteria.registrationRequired
                          ? `${fed.acronym} registration is mandatory`
                          : `${fed.acronym} registration not required for all events`}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="leading-snug text-slate-600">
                        {fed.eligibilityCriteria.stateAssociationFirst
                          ? "Register with your State Association first"
                          : "Direct national federation registration available"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-title text-xl font-bold leading-tight tracking-tight text-slate-900">
        {children}
      </h2>
      <div className="bg-power-orange mt-1.5 h-[3px] w-7 rounded-full" />
    </div>
  );
}

function RequirementPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}
    >
      <div
        className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`}
      />
      <span className={`text-sm font-medium ${active ? "text-emerald-800" : "text-slate-500"}`}>
        {label}
      </span>
    </div>
  );
}
