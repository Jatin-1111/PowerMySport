"use client";

import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  ChevronDown,
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
  Sparkles,
  Trophy,
  Users,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { BackToRoadmapLink } from "@/components/BackToRoadmapLink";
import { useEffect, useRef, useState, useCallback } from "react";
import type { FederationDetail } from "./page";
import type { Tournament } from "@/modules/sports/services/pathway";
import { federationApi } from "@/modules/sports/services/pathway";

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
  govt: { label: "Government Body", bg: "bg-blue-500/20", text: "text-blue-200", border: "border-blue-400/30" },
  national: { label: "National Federation", bg: "bg-emerald-500/20", text: "text-emerald-200", border: "border-emerald-400/30" },
  hybrid: { label: "Public-Private Body", bg: "bg-violet-500/20", text: "text-violet-200", border: "border-violet-400/30" },
} as const;

const LEVEL_COLORS: Record<string, { pill: string; dot: string }> = {
  international: { pill: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  national: { pill: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  state: { pill: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  district: { pill: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  zonal: { pill: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

function levelColor(level: string) {
  return LEVEL_COLORS[level.toLowerCase()] ?? { pill: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" };
}

const TABS = [
  { id: "overview", label: "Overview", icon: Globe },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "eligibility", label: "Eligibility", icon: Users },
  { id: "register", label: "How to Register", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

const LEVEL_FILTERS = ["All", "International", "National", "State", "District", "Zonal"] as const;

// ─── Main client component ────────────────────────────────────────────────────

export function FederationDetailClient({
  federation: fed,
  initialTab = "overview",
}: {
  federation: FederationDetail;
  initialTab?: TabId;
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

  const sportLabel = SPORT_LABEL[fed.sportSlug] ?? fed.sportSlug;
  const typeMeta = TYPE_META[fed.type];
  const isVerified = !!fed.dataVerifiedAt;

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

  const filteredTournaments = tournaments.filter((t) => {
    if (levelFilter !== "All" && !t.level.toLowerCase().includes(levelFilter.toLowerCase())) return false;
    if (ageGroupFilter && !t.ageGroup?.toLowerCase().includes(ageGroupFilter.toLowerCase())) return false;
    if (tournamentSearch && !t.name.toLowerCase().includes(tournamentSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="min-h-screen">

      {/* ── Hero ── */}
      <div className="bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">

          {/* Breadcrumb */}
          <div className="pt-5 pb-4 border-b border-white/[0.07]">
            <BackToRoadmapLink />
          </div>

          {/* Header content */}
          <div className="pt-7 pb-9">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border}`}>
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
              <div className="hidden sm:flex shrink-0 h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white/[0.08] text-2xl font-black text-white tracking-tight select-none">
                {fed.acronym.slice(0, 2)}
              </div>
              <div>
                <h1 className="font-title text-4xl sm:text-5xl font-bold text-white leading-[1.05] tracking-tight">
                  {fed.acronym}
                </h1>
                <p className="mt-2 text-base text-white/50 font-medium">
                  {fed.name}
                </p>
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
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-5 py-2.5 text-sm font-bold shadow hover:bg-slate-50 transition"
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
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.15] bg-white/[0.07] text-white/75 px-5 py-2.5 text-sm font-bold hover:bg-white/[0.14] hover:text-white transition"
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
        className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex overflow-x-auto scrollbar-none gap-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-power-orange text-power-orange"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
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
          <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
            <div className="space-y-6">

              {/* About */}
              <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                <SectionHeading>About {fed.acronym}</SectionHeading>
                <p className="text-[15px] text-slate-600 leading-[1.85]">
                  {fed.about}
                </p>
              </section>

              {/* Key Facts */}
              {fed.keyFacts && fed.keyFacts.length > 0 && (
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                  <SectionHeading>Key Facts</SectionHeading>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {fed.keyFacts.map((fact, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-700 leading-snug">{fact}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Affiliations */}
              {fed.affiliations && fed.affiliations.length > 0 && (
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
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
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                  <SectionHeading>State Associations</SectionHeading>
                  <p className="text-sm text-slate-500 mb-5">
                    Your child must register with the state association for your state before participating in national events.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {fed.stateAssociations.map((sa, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800 leading-tight">{sa.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{sa.state}</p>
                        </div>
                        {sa.website && (
                          <a
                            href={sa.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-slate-400 hover:text-power-orange transition"
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
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-start gap-3">
                  <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Data verified by PowerMySport</p>
                    <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                      This federation profile was manually cross-checked against official sources on{" "}
                      {new Date(fed.dataVerifiedAt!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
                      {fed.sourceUrls?.[0] && (
                        <>
                          {" "}Primary source:{" "}
                          <a href={fed.sourceUrls[0]} target="_blank" rel="noopener noreferrer" className="underline font-medium">
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
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400 mb-3">
                  In this guide
                </p>
                <div className="space-y-1.5">
                  {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => switchTab(id)}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-left transition ${
                        activeTab === id
                          ? "bg-orange-50 text-power-orange"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                      <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-40" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact */}
              {(fed.contact?.email || fed.contact?.phone || fed.contact?.address) && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Contact</p>
                  {fed.contact.email && (
                    <a href={`mailto:${fed.contact.email}`} className="flex items-start gap-2.5 text-sm text-slate-600 hover:text-power-orange transition">
                      <Mail className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
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
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                      <span className="leading-snug">{fed.contact.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="rounded-2xl bg-slate-900 p-5 relative overflow-hidden">
                <div className="pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full bg-power-orange/[0.12] blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-power-orange" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-power-orange">Concierge</p>
                  </div>
                  <p className="text-[15px] font-bold text-white mb-1.5 leading-snug">
                    We handle registration for you
                  </p>
                  <p className="text-xs text-white/45 leading-relaxed mb-4">
                    Federation IDs, documents, form submissions — our team takes care of everything at no cost.
                  </p>
                  <Link
                    href={`/roadmap?sport=${encodeURIComponent(sportLabel)}`}
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-power-orange py-2.5 text-sm font-bold text-white hover:bg-orange-500 transition"
                  >
                    Get Concierge Help
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ── Tournaments tab ── */}
        {activeTab === "tournaments" && (
          <div id="tournaments" className="space-y-5">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tournaments…"
                  value={tournamentSearch}
                  onChange={(e) => setTournamentSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-power-orange/20 focus:border-power-orange"
                />
              </div>
              {/* Age group */}
              <input
                type="text"
                placeholder="Age group (e.g. U-14)…"
                value={ageGroupFilter}
                onChange={(e) => setAgeGroupFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-power-orange/20 focus:border-power-orange w-48"
              />
              {/* Level pills */}
              <div className="flex flex-wrap gap-1.5">
                {LEVEL_FILTERS.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevelFilter(l)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      levelFilter === l
                        ? "bg-power-orange border-power-orange text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-power-orange"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            {tournamentsLoaded && (
              <p className="text-xs text-slate-500">
                Showing {filteredTournaments.length} of {tournamentTotal} tournaments
              </p>
            )}

            {/* Loading */}
            {tournamentsLoading && (
              <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
                <div className="inline-block h-5 w-5 rounded-full border-2 border-power-orange border-t-transparent animate-spin" />
                <p className="mt-3 text-sm text-slate-500">Loading tournaments…</p>
              </div>
            )}

            {/* Grid */}
            {!tournamentsLoading && tournamentsLoaded && filteredTournaments.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTournaments.map((t, i) => {
                  const lc = levelColor(t.level);
                  return (
                    <Link
                      key={i}
                      href={t.slug ? `/federations/${fed.slug}/${t.slug}` : "#"}
                      className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] hover:border-orange-200 hover:-translate-y-0.5"
                    >
                      <div className="h-[3px] w-full bg-gradient-to-r from-power-orange to-amber-400" />
                      <div className="flex flex-col p-4" style={{ minHeight: "130px" }}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${lc.pill}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${lc.dot}`} />
                            {t.level}
                          </span>
                        </div>
                        <p className="font-title font-bold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">
                          {t.name}
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                          {t.ageGroup ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
                              <Users className="h-3 w-3 shrink-0" />
                              <span className="truncate">{t.ageGroup}</span>
                            </div>
                          ) : (
                            <span />
                          )}
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-power-orange group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {!tournamentsLoading && tournamentsLoaded && filteredTournaments.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
                <Trophy className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">No tournaments match these filters</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing the filters above</p>
              </div>
            )}

            {!tournamentsLoaded && !tournamentsLoading && (
              <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center">
                <p className="text-sm text-slate-500">Tournament data is loading…</p>
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
                      <div className="shrink-0 h-8 w-8 rounded-xl bg-amber-100 flex items-center justify-center mt-0.5">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-900 mb-1">Age Cut-off Rule</p>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          {fed.eligibilityCriteria.ageCutoffRule}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Category table */}
                {fed.eligibilityCriteria.categories.length > 0 && (
                  <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                    <SectionHeading>Age Categories</SectionHeading>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-3 pr-4 text-xs font-bold uppercase tracking-wider text-slate-400">Category</th>
                            <th className="text-left py-3 pr-4 text-xs font-bold uppercase tracking-wider text-slate-400">Max Age</th>
                            <th className="text-left py-3 pr-4 text-xs font-bold uppercase tracking-wider text-slate-400">Genders</th>
                            <th className="text-left py-3 text-xs font-bold uppercase tracking-wider text-slate-400">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {fed.eligibilityCriteria.categories.map((cat, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 pr-4 font-bold text-slate-900">{cat.name}</td>
                              <td className="py-3.5 pr-4 text-slate-600">
                                {cat.maxAge === 99 ? "No limit" : `Under ${cat.maxAge}`}
                              </td>
                              <td className="py-3.5 pr-4">
                                <div className="flex flex-wrap gap-1">
                                  {cat.genders.map((g) => (
                                    <span key={g} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                      {g}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3.5 text-xs text-slate-500 leading-relaxed max-w-[280px]">
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
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                  <SectionHeading>Registration Requirements</SectionHeading>
                  <div className="grid sm:grid-cols-2 gap-3 mb-5">
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
                        <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-slate-600 leading-relaxed">
                          {fed.eligibilityCriteria.notes}
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Source notice */}
                {isVerified && fed.sourceUrls && fed.sourceUrls.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-start gap-3">
                    <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 mb-1">Verified eligibility data</p>
                      <p className="text-xs text-emerald-700 leading-relaxed">
                        This eligibility information was cross-checked against the official {fed.acronym} rulebook and tournament circulars.
                        Always confirm the exact cutoff dates in the official tournament circular before entering.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[...new Set(fed.sourceUrls)].map((url, i) => {
                          let hostname = url;
                          try { hostname = new URL(url).hostname; } catch {}
                          return (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 underline hover:text-emerald-900 transition"
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
                <Users className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Eligibility data coming soon</p>
                <p className="text-xs text-slate-400 mt-1">
                  We&apos;re verifying this information against official {fed.acronym} sources.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── How to Register tab ── */}
        {activeTab === "register" && (
          <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
            <div className="space-y-6">

              {/* Steps */}
              {fed.registrationSteps && fed.registrationSteps.length > 0 ? (
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                  <SectionHeading>Step-by-Step Registration</SectionHeading>
                  <p className="text-sm text-slate-400 mb-8">
                    Follow these steps in order. Starting early gives your child a significant advantage — many spots fill fast.
                  </p>
                  <ol className="space-y-6">
                    {fed.registrationSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-power-orange/10 border-2 border-power-orange/20 text-sm font-bold text-power-orange">
                          {i + 1}
                        </span>
                        <p className="flex-1 pt-1 text-[15px] text-slate-700 leading-relaxed">
                          {step}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 py-10 text-center text-slate-500 text-sm">
                  Registration steps not yet available for this federation.
                </div>
              )}

              {/* Required documents */}
              {fed.requiredDocuments && fed.requiredDocuments.length > 0 && (
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-7 sm:p-8">
                  <SectionHeading>Required Documents</SectionHeading>
                  <p className="text-sm text-slate-400 mb-6">
                    Prepare these before the tournament entry deadline — missing documents result in rejection.
                  </p>
                  <ul className="space-y-3">
                    {fed.requiredDocuments.map((doc, i) => (
                      <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="shrink-0 h-5 w-5 mt-0.5 rounded border border-slate-300 flex items-center justify-center">
                          <FileText className="h-3 w-3 text-slate-400" />
                        </div>
                        <span className="text-[14px] text-slate-700 leading-snug">{doc}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Sidebar — Concierge */}
            <aside className="space-y-4 lg:sticky lg:top-20">
              <div className="rounded-2xl bg-slate-900 p-6 relative overflow-hidden">
                <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-power-orange/[0.12] blur-2xl" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-power-orange/[0.07] blur-2xl" />
                <div className="relative z-10">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Sparkles className="h-3.5 w-3.5 text-power-orange" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-power-orange">
                      PowerMySport Concierge
                    </p>
                  </div>
                  <h3 className="font-title text-[17px] font-bold text-white mb-2 leading-snug">
                    We handle registration for you
                  </h3>
                  <p className="text-[13px] text-white/50 leading-relaxed mb-5">
                    Federation IDs, documents, form submissions — our team takes care of all of it. At no cost.
                  </p>
                  <ul className="space-y-2 mb-5">
                    {[
                      `Get your child's ${fed.acronym} number`,
                      "Prepare and submit all required documents",
                      "Monitor deadlines and confirm your entry",
                    ].map((line, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-[12px] text-white/60">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/roadmap?sport=${encodeURIComponent(sportLabel)}`}
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-power-orange py-3 text-sm font-bold text-white hover:bg-orange-500 transition shadow-lg shadow-orange-900/30"
                  >
                    Get Concierge Help
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  {fed.website && (
                    <a
                      href={fed.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full mt-2 py-2.5 text-xs font-semibold text-white/35 hover:text-white/65 transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Official {fed.acronym} Portal
                    </a>
                  )}
                </div>
              </div>

              {/* Quick facts */}
              {fed.eligibilityCriteria && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400 mb-3">Quick reference</p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2.5">
                      <BadgeCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600 leading-snug">
                        {fed.eligibilityCriteria.registrationRequired
                          ? `${fed.acronym} registration is mandatory`
                          : `${fed.acronym} registration not required for all events`}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <BadgeCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600 leading-snug">
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
      <h2 className="font-title text-xl font-bold text-slate-900 tracking-tight leading-tight">
        {children}
      </h2>
      <div className="mt-1.5 h-[3px] w-7 bg-power-orange rounded-full" />
    </div>
  );
}

function RequirementPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 border ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <div className={`h-2 w-2 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className={`text-sm font-medium ${active ? "text-emerald-800" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}
