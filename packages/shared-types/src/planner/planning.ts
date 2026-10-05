/**
 * How events sit next to each other on a season.
 *
 * Shared because two places must agree on what "a clash" is: the planner page,
 * which warns about the plan a parent has built, and the recommender, which must
 * not suggest an event that clashes with it. If they used two definitions, the
 * page would warn about a pair the recommender had just proposed.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clear days wanted between one event ending and the next starting.
 *
 * Our own rule of thumb, not the federation's: two events with no day between
 * them leave no time to travel or recover. It is a prompt to look, so it is
 * worded as one, and it never blocks anything a parent chooses themselves.
 */
export const MIN_REST_DAYS = 2;

/** Whole days since the epoch, for the UTC calendar date of an ISO timestamp. */
export const dayNumber = (iso: string): number => {
  const date = new Date(iso);
  return Math.round(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS
  );
};

/**
 * Clear days between two events, `earlier` first. Negative means they overlap
 * (an event ending the day another starts is -1: they share that day).
 */
export const clearDaysBetween = (
  earlier: { startDate: string; endDate?: string | null | undefined },
  later: { startDate: string }
): number => dayNumber(later.startDate) - dayNumber(earlier.endDate ?? earlier.startDate) - 1;

export interface PlanWarning {
  /** The later event of the pair, so the warning sits beside the one at risk. */
  slug: string;
  message: string;
}

interface PlanEvent {
  slug: string;
  name: string;
  startDate: string;
  endDate?: string | null | undefined;
}

/**
 * Overlaps and tight gaps between consecutive events on a plan.
 *
 * Only adjacent pairs are compared, because a long event overlapping two later
 * ones is reported once against each, which is where a parent would look.
 */
export function planWarnings(events: PlanEvent[]): PlanWarning[] {
  const sorted = [...events].sort((a, b) => dayNumber(a.startDate) - dayNumber(b.startDate));
  const warnings: PlanWarning[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const next = sorted[index]!;
    const clearDays = clearDaysBetween(previous, next);

    if (clearDays < 0) {
      warnings.push({ slug: next.slug, message: `Overlaps with ${previous.name}.` });
    } else if (clearDays < MIN_REST_DAYS) {
      warnings.push({
        slug: next.slug,
        message:
          clearDays === 0
            ? `Starts the day after ${previous.name} ends.`
            : `Only ${clearDays} clear day after ${previous.name} ends.`,
      });
    }
  }
  return warnings;
}
