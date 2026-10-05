import { dayNumber } from "@powermysport/shared-types";
import type { PlannerOverview } from "../PlannerService";
import type { Candidate, CommittedEvent, RecommendationContext } from "./types";

/**
 * From the planner's verdicts to the short list the recommender may draw on.
 *
 * Everything excluded here is excluded by a rule a parent can read, never by the
 * model, so "why is X not suggested" always has a plain answer:
 *
 *   - not open to the child: the entry rules already removed it
 *   - already on the plan: it is a fixed point, not a suggestion
 *   - entries closed: the federation's own published deadline has passed
 *   - inside a blocked date range: the parent said the child cannot play then
 *
 * Only the child's own age group is suggested. Playing up spends the same yearly
 * allowance and is a decision for a parent to make, so it is shown on the page
 * but never proposed.
 */

const normalizeState = (value: string | null | undefined): string =>
  (value ?? "").toLowerCase().replace(/[^a-z]/g, "");

const intersects = (
  event: { startDate: string; endDate?: string | undefined },
  range: { from: string; to: string }
): boolean => {
  const start = dayNumber(event.startDate);
  const end = dayNumber(event.endDate ?? event.startDate);
  return start <= dayNumber(range.to) && end >= dayNumber(range.from);
};

export const todayOf = (now: Date): string => now.toISOString().slice(0, 10);

export function buildContext(overview: PlannerOverview, now: Date): RecommendationContext | null {
  if (overview.linkState !== "ready" || !overview.standing || !overview.shortlist) return null;

  const today = todayOf(now);
  const { standing, shortlist, plan } = overview;
  const blockedRanges = plan.preferences.blockedRanges;
  const plannedSlugs = new Set(plan.entries.map((entry) => entry.editionSlug));

  // Entries closed is judged on the calendar date: a deadline on the 12th is
  // still live all day on the 12th.
  const entriesClosed = (deadline: string | undefined): boolean =>
    Boolean(deadline) && dayNumber(deadline!) < dayNumber(today);

  const candidates: Candidate[] = [];
  let blocked = 0;
  let closed = 0;

  for (const entry of shortlist.ownGroup) {
    const { edition } = entry;
    if (!edition.slug || plannedSlugs.has(edition.slug)) continue;
    if (entriesClosed(edition.registrationDeadlineDate ?? undefined)) {
      closed += 1;
      continue;
    }
    const span = {
      startDate: edition.startDate,
      ...(edition.endDate ? { endDate: edition.endDate } : {}),
    };
    if (blockedRanges.some((range) => intersects(span, range))) {
      blocked += 1;
      continue;
    }
    candidates.push({
      slug: edition.slug,
      name: edition.name,
      startDate: edition.startDate,
      ...(edition.endDate ? { endDate: edition.endDate } : {}),
      ...(edition.city ? { city: edition.city } : {}),
      ...(edition.state ? { state: edition.state } : {}),
      ...(edition.ladder ? { ladder: edition.ladder } : {}),
      ...(typeof edition.grade === "number" ? { grade: edition.grade } : {}),
      deadline: edition.registrationDeadlineDate ?? null,
      inHomeState:
        Boolean(edition.state) &&
        Boolean(standing.state) &&
        normalizeState(edition.state) === normalizeState(standing.state),
    });
  }

  // The calendar knows an event's end date; the plan entry only kept the start.
  const live = new Map(
    [...shortlist.ownGroup, ...shortlist.playingUp, ...shortlist.unknown, ...shortlist.closed]
      .filter((entry) => entry.edition.slug)
      .map((entry) => [entry.edition.slug!, entry.edition])
  );
  const committed: CommittedEvent[] = plan.entries
    .filter((entry) => entry.status !== "played")
    .filter((entry) => dayNumber(new Date(entry.startDate).toISOString()) >= dayNumber(today))
    .map((entry) => {
      const endDate = live.get(entry.editionSlug)?.endDate;
      return {
        slug: entry.editionSlug,
        name: entry.name,
        startDate: new Date(entry.startDate).toISOString(),
        ...(endDate ? { endDate } : {}),
      };
    });

  // The yearly allowance is the calendar year's. It counts what is on this plan,
  // which is all we can see, so it can only over-state what is left.
  const year = now.getUTCFullYear();
  const used = plan.entries.filter(
    (entry) => new Date(entry.startDate).getUTCFullYear() === year
  ).length;
  const allowanceLeft =
    overview.annualEntryCap === null ? null : Math.max(0, overview.annualEntryCap - used);

  const goal = plan.preferences.goal;
  return {
    today,
    child: {
      firstName: overview.dependentName.split(/\s+/)[0] || "Your child",
      list: `${standing.category} ${standing.subcategory}`,
      rank: standing.rank,
      state: standing.state,
    },
    goal,
    // "Closest to home" needs a home state to mean anything.
    effectiveGoal: goal === "home" && !standing.state ? "experience" : goal,
    allowanceLeft,
    blockedRanges,
    candidates,
    committed,
    skipped: { blocked, entriesClosed: closed },
  };
}
