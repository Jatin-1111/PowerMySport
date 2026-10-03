"use client";

import { BadgeCheck, Calendar, ExternalLink, Globe, Landmark, MapPin } from "lucide-react";
import { BackToRoadmapLink } from "@/modules/pathway/components/BackToRoadmapLink";
import { Button } from "@/modules/shared/ui/Button";
import { PageHeader } from "@/modules/shared/ui/PageHeader";
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
      <PageHeader
        breadcrumbs={[{ label: "Federations", href: "/federations" }, { label: fed.acronym }]}
        badges={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1 text-xs font-bold ${typeMeta.bg} ${typeMeta.text} ${typeMeta.border}`}
            >
              <Landmark className="h-3 w-3" />
              {typeMeta.label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
              <Globe className="h-3 w-3" />
              {sportLabel}
            </span>
            {isVerified && (
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <BadgeCheck className="h-3 w-3" />
                Data verified
              </span>
            )}
          </>
        }
        title={fed.acronym}
        description={fed.name}
        meta={
          fed.headquarters && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden className="h-3.5 w-3.5" />
              {fed.headquarters}
              {fed.founded && ` · Est. ${fed.founded}`}
            </span>
          )
        }
        actions={
          <>
            {fed.website && (
              <Button asChild variant="secondary">
                <a href={fed.website} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden className="h-4 w-4" />
                  Official website
                </a>
              </Button>
            )}
            {fed.officialCalendarUrl && (
              <Button asChild variant="outline">
                <a href={fed.officialCalendarUrl} target="_blank" rel="noopener noreferrer">
                  <Calendar aria-hidden className="h-4 w-4" />
                  Tournament calendar
                </a>
              </Button>
            )}
            <BackToRoadmapLink
              sportSlug={fed.sportSlug}
              hasPathway={hasPathway}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 sm:self-center"
            />
          </>
        }
      />

      {/* ── Sticky tab bar ── */}
      <div
        ref={tabBarRef}
        className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="scrollbar-none flex gap-0 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === id
                    ? "border-power-orange text-power-orange-solid"
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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
