import { TournamentEdition } from "../models/TournamentEdition";

/**
 * Read-only queries over TournamentEdition, which is populated by the
 * admin-managed data-source review flow (DataSourceExtractionService.ts /
 * dataSourceAdminController.ts).
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
    // Merged duplicates only redirect; without this the chat can name the same
    // tournament twice in a three-item answer.
    mergedInto: { $in: [null, undefined] },
  })
    .sort({ startDate: 1 })
    .limit(limit)
    .lean() as any;
}
