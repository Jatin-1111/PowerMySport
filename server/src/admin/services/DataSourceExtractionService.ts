/**
 * AI extraction for admin-submitted federation/tournament data sources
 * (a link or an uploaded PDF). Replaces the retired Lane-A cron scraper —
 * this only ever writes onto the submission doc itself (`extractedData`,
 * `status`); nothing here touches the live Federation/Tournament/
 * TournamentEdition collections. That write only happens from an explicit
 * admin "approve" action in dataSourceAdminController.
 *
 * Gemini plumbing (getClient/modelCandidates/JSON parsing/urlContext
 * two-step) mirrors what tournamentCalendarService.ts used to do — that file
 * is being retired, so the pattern is duplicated here rather than imported.
 */
export * from "./dataSourceExtraction/gemini";
export * from "./dataSourceExtraction/http";
export * from "./dataSourceExtraction/valueParsing";
export * from "./dataSourceExtraction/editions";
export * from "./dataSourceExtraction/detailEnrichment";
export * from "./dataSourceExtraction/submission";
