import { TournamentEdition } from "../models/TournamentEdition";

/**
 * Read-only queries over TournamentEdition. Relocated from the retired
 * Lane-A cron scraper (tournamentCalendarService.ts) — TournamentEdition is
 * now populated by the admin-managed data-source review flow
 * (DataSourceExtractionService.ts / dataSourceAdminController.ts) instead of
 * a scraper, but this read path is unchanged.
 */

/** The chat-facing query: next upcoming editions for a sport, soonest first. */
export async function getUpcomingEditions(
  sportSlug: string,
  limit: number = 3
): Promise<
  Array<{
    name: string;
    startDate: Date;
    endDate?: Date;
    registrationDeadlineDate?: Date;
    city?: string;
    venue?: string;
    level?: string;
    ageGroups?: string[];
    sourceUrl: string;
    lastCheckedAt: Date;
  }>
> {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return TournamentEdition.find({
    sportSlug,
    startDate: { $gte: startOfToday },
    status: { $ne: "cancelled" },
  })
    .sort({ startDate: 1 })
    .limit(limit)
    .lean() as any;
}
