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

// ─── Looking one tournament up by what a parent calls it ──────────────────────

/**
 * Words that carry the shape of a question and not the name of an event. "When do entries close
 * for the Delhi tournament" is searched as "delhi". Words that are part of real names
 * ("championship", "open", "junior") stay, so a named event is still found.
 */
const QUESTION_WORDS = new Set([
  "the",
  "a",
  "an",
  "in",
  "at",
  "of",
  "for",
  "to",
  "my",
  "our",
  "is",
  "are",
  "do",
  "does",
  "did",
  "when",
  "where",
  "what",
  "how",
  "much",
  "many",
  "which",
  "tournament",
  "tournaments",
  "event",
  "events",
  "entry",
  "entries",
  "close",
  "closes",
  "closing",
  "deadline",
  "fee",
  "fees",
  "date",
  "dates",
  "cost",
  "held",
  "venue",
  "about",
  "tell",
  "me",
]);

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The words of a question that could be in an event's name or place. At most six. */
export function searchTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2);
  const kept = words.filter((word) => !QUESTION_WORDS.has(word));
  return (kept.length > 0 ? kept : words).slice(0, 6);
}

export interface EditionForChat {
  name: string;
  officialName?: string;
  slug?: string;
  sportSlug: string;
  startDate: Date;
  endDate?: Date;
  city?: string;
  state?: string;
  venue?: string;
  level?: string;
  ladder?: string;
  ageGroups?: string[];
  surface?: string;
  entryOpensDate?: Date;
  registrationDeadlineDate?: Date;
  withdrawalDeadlineDate?: Date;
  deadlineTimes?: { entryCloses?: string; withdrawal?: string; freeze?: string };
  feeSingles?: number;
  feeDoubles?: number;
  detailUrl?: string;
  lastCheckedAt: Date;
}

/**
 * Upcoming or ongoing tournaments whose name or place contains every word of the query, soonest
 * first. One more than `limit` is fetched so the caller can say there were others.
 */
export async function findEditionsForChat(params: {
  query: string;
  sportSlug?: string;
  limit?: number;
}): Promise<{ editions: EditionForChat[]; more: boolean }> {
  const limit = params.limit ?? 3;
  const terms = searchTerms(params.query);
  if (terms.length === 0) return { editions: [], more: false };

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const found = (await TournamentEdition.find({
    ...(params.sportSlug ? { sportSlug: params.sportSlug.toLowerCase() } : {}),
    status: { $ne: "cancelled" },
    mergedInto: { $in: [null, undefined] },
    $and: [
      // Not finished: it ends today or later, or has no end date and starts today or later.
      {
        $or: [
          { endDate: { $gte: startOfToday } },
          { endDate: { $in: [null, undefined] }, startDate: { $gte: startOfToday } },
        ],
      },
      ...terms.map((term) => {
        const pattern = new RegExp(escapeRegex(term), "i");
        return {
          $or: [
            { name: pattern },
            { officialName: pattern },
            { city: pattern },
            { state: pattern },
            { venue: pattern },
            { slug: pattern },
          ],
        };
      }),
    ],
  })
    .sort({ startDate: 1 })
    .limit(limit + 1)
    .lean()) as unknown as EditionForChat[];

  return { editions: found.slice(0, limit), more: found.length > limit };
}
