/**
 * Lane-A tournament source registry.
 *
 * Hand-curated official calendar pages per priority sport. The Lane-A
 * pipeline (tournamentCalendarService) reads these exact pages and extracts
 * dated tournament editions — "LLM as reader, not researcher". The long tail
 * of sports not listed here continues to use the Lane-B search-grounding
 * pipeline (RealDataScraperService).
 *
 * Maintenance model: if a federation moves its calendar page, the pipeline's
 * zero-yield warning surfaces it and the fix is a one-line URL update here.
 *
 * `{{YEAR}}` in a URL is replaced with the current calendar year at fetch
 * time (and the pipeline also fetches next year's page during Oct–Dec so
 * early-announced editions are picked up).
 */

export type CalendarFetchStrategy = "direct" | "urlContext";

export interface TournamentSource {
  /** Official calendar/listing URL. May contain {{YEAR}}. */
  url: string;
  /**
   * How to obtain page content:
   *  - "direct": plain HTTP fetch works (server-rendered page)
   *  - "urlContext": page is JS-rendered or bot-gated; let Gemini's
   *    urlContext tool fetch it on Google's side
   */
  fetchStrategy: CalendarFetchStrategy;
  /** Human note for future maintainers — what this page looks like */
  note?: string;
}

export interface SportTournamentSources {
  sportSlug: string;
  sportName: string;
  sources: TournamentSource[];
}

export const TOURNAMENT_SOURCE_REGISTRY: SportTournamentSources[] = [
  {
    sportSlug: "tennis",
    sportName: "Tennis",
    sources: [
      {
        url: "https://aitatennis.com/management/calendar.php?year={{YEAR}}",
        fetchStrategy: "direct",
        note: "AITA full-year weekly calendar table. Columns = age groups (U10–U18, Men/Women/Senior); cells = series code + city, e.g. 'CS7 (Delhi)'. Series codes: CS=Championship Series, NS=National Series, SS=Super Series, TS=Talent Series.",
      },
    ],
  },
  {
    sportSlug: "chess",
    sportName: "Chess",
    sources: [
      {
        url: "https://aicf.in/all-events/",
        fetchStrategy: "direct",
        note: "AICF events listing — FIDE-rated and national events with dates and venues.",
      },
    ],
  },
  {
    sportSlug: "badminton",
    sportName: "Badminton",
    sources: [
      {
        url: "https://www.badmintonindia.org/tournaments",
        fetchStrategy: "urlContext",
        note: "BAI tournament calendar. Serves empty HTML to non-browser clients (JS-rendered) — must go through Gemini urlContext.",
      },
    ],
  },
];

export function getTournamentSources(
  sportSlug: string,
): SportTournamentSources | undefined {
  return TOURNAMENT_SOURCE_REGISTRY.find((s) => s.sportSlug === sportSlug);
}

export function isCalendarSport(sportSlug: string): boolean {
  return TOURNAMENT_SOURCE_REGISTRY.some((s) => s.sportSlug === sportSlug);
}
