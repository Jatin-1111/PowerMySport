"use client";

import { BadgeCheck, Calendar, ExternalLink, Globe, Landmark, MapPin } from "lucide-react";
import { BackToRoadmapLink } from "@/modules/pathway/components/BackToRoadmapLink";
import { useRef, useState, useCallback } from "react";
import type { FederationDetail } from "./page";
import { getSportArchetypeInfo } from "@/modules/sports/config/sportArchetypes";
import {
  ARCHETYPE_CALENDAR_NOTE,
  SPORT_LABEL,
  TABS,
  TYPE_META,
  type TabId,
} from "./federationShared";
import { useFederationTournaments } from "./hooks/useFederationTournaments";
import { useFederationCalendar } from "./hooks/useFederationCalendar";
import { OverviewTab } from "./tabs/OverviewTab";
import { TournamentsTab } from "./tabs/TournamentsTab";
import { CalendarTab } from "./tabs/CalendarTab";
import { EligibilityTab } from "./tabs/EligibilityTab";
import { RegisterTab } from "./tabs/RegisterTab";

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

  const tournamentsData = useFederationTournaments(fed.slug, activeTab);
  const calendarData = useFederationCalendar(fed.slug, activeTab);

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
        {activeTab === "overview" && (
          <OverviewTab
            fed={fed}
            sportLabel={sportLabel}
            isVerified={isVerified}
            activeTab={activeTab}
            switchTab={switchTab}
          />
        )}

        {activeTab === "tournaments" && (
          <TournamentsTab
            sportLabel={sportLabel}
            switchTab={switchTab}
            tournamentsLoading={tournamentsData.tournamentsLoading}
            tournamentsLoaded={tournamentsData.tournamentsLoaded}
            tournamentTotal={tournamentsData.tournamentTotal}
            levelFilter={tournamentsData.activeLevelFilter}
            setLevelFilter={tournamentsData.setLevelFilter}
            ageGroupFilter={tournamentsData.ageGroupFilter}
            setAgeGroupFilter={tournamentsData.setAgeGroupFilter}
            tournamentSearch={tournamentsData.tournamentSearch}
            setTournamentSearch={tournamentsData.setTournamentSearch}
            levelFilterOptions={tournamentsData.levelFilterOptions}
            showLevelFilters={tournamentsData.showLevelFilters}
            filteredTournaments={tournamentsData.filteredTournaments}
            editionsLoaded={calendarData.editionsLoaded}
            editionsCount={calendarData.editions.length}
          />
        )}

        {activeTab === "calendar" && (
          <CalendarTab
            fedAcronym={fed.acronym}
            officialCalendarUrl={fed.officialCalendarUrl}
            sportLabel={sportLabel}
            switchTab={switchTab}
            archetypeNote={archetypeNote}
            editions={calendarData.editions}
            editionsLoading={calendarData.editionsLoading}
            editionsLoaded={calendarData.editionsLoaded}
            editionsLastChecked={calendarData.editionsLastChecked}
            editionAgeGroup={calendarData.editionAgeGroup}
            setEditionAgeGroup={calendarData.setEditionAgeGroup}
            editionState={calendarData.editionState}
            setEditionState={calendarData.setEditionState}
            openSeries={calendarData.openSeries}
            setOpenSeries={calendarData.setOpenSeries}
            setEditionDate={calendarData.setEditionDate}
            showEditionFilters={calendarData.showEditionFilters}
            setShowEditionFilters={calendarData.setShowEditionFilters}
            savedEventKeys={calendarData.savedEventKeys}
            markSavedToCalendar={calendarData.markSavedToCalendar}
            editionAgeGroupOptions={calendarData.editionAgeGroupOptions}
            editionStateOptions={calendarData.editionStateOptions}
            filteredEditions={calendarData.filteredEditions}
            editionMonths={calendarData.editionMonths}
            activeMonthKey={calendarData.activeMonthKey}
            setEditionMonth={calendarData.setEditionMonth}
            activeMonth={calendarData.activeMonth}
            editionFiltersActive={calendarData.editionFiltersActive}
            monthEditions={calendarData.monthEditions}
            activeDate={calendarData.activeDate}
            visibleEditions={calendarData.visibleEditions}
            visibleSeries={calendarData.visibleSeries}
          />
        )}

        {activeTab === "eligibility" && <EligibilityTab fed={fed} isVerified={isVerified} />}

        {activeTab === "register" && <RegisterTab fed={fed} sportLabel={sportLabel} />}
      </div>
    </main>
  );
}
