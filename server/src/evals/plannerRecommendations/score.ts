import { MIN_REST_DAYS, dayNumber } from "@powermysport/shared-types";
import { AITA_LADDER_ORDER } from "../../shared/services/aita/editionSeries";
import { realismOf } from "../../client/services/plannerRecommendations/builder";
import { reasonIsGrounded } from "../../client/services/plannerRecommendations/validate";
import {
  MAX_CONSIDER,
  MAX_RECOMMENDED,
  type Candidate,
  type RecommendationContext,
  type RecommendationResult,
} from "../../client/services/plannerRecommendations/types";

/**
 * How good is one answer, in numbers.
 *
 * Two kinds of number, and they must never be mixed up:
 *
 *   VIOLATIONS are rule breaks. The answer is wrong if any is above zero: an event that
 *   was never offered, two events that overlap, a pick inside the parent's blocked dates.
 *   They are counted by arithmetic written here, not by calling the code that built the
 *   answer, so a bug in that code cannot hide itself.
 *
 *   DIAGNOSTICS describe the answer without judging it: how much of it is out of reach,
 *   how spread out it is, how repetitive its reasons are. Some of these decide a
 *   product question (is the model worth its cost?) but none is a pass or a fail alone.
 *
 * What is NOT here, on purpose: whether a pick is REALISTIC for the child. That needs a
 * person who knows the circuit, so it is read from hand labels (`labels.ts`) when they
 * exist, and the diagnostic `reachCount` stands in until then.
 */

export interface Violations {
  /** A pick that is not one of the events the rules allowed. */
  notOffered: number;
  /** The same event twice. */
  duplicate: number;
  /** Two recommended events (or one and something already planned) sharing a day. */
  overlap: number;
  /** Too few clear days between recommended events. */
  tooClose: number;
  /** A pick on top of something already planned. */
  onTopOfPlan: number;
  /** A pick that runs into dates the parent said the child cannot play. */
  insideBlocked: number;
  /** A pick whose entries closed before today. */
  entriesClosed: number;
  /** More recommended events than there are yearly entries left. */
  overAllowance: number;
  tooManyRecommended: number;
  tooManyConsider: number;
  /** Events offered as options although no yearly entry is left to enter them with. */
  suggestedWithNoAllowance: number;
  /**
   * A recommended event that past draws, or the lack of them, do not support: the rank
   * would mostly have meant the qualifying, was outside both, or the level is cut by
   * ranking and there is no history to say. Such an event may be an option, never a pick.
   */
  recommendedUnrealistic: number;
  /** A reason that fails the same checks every reason must pass. */
  ungroundedReason: number;
  /** Nothing recommended although there was room and something to choose from. */
  emptyWithRoom: number;
}

export interface Diagnostics {
  recommended: number;
  consider: number;
  /** Recommended events above Championship Series: draws cut by ranking. */
  reachCount: number;
  reachShare: number;
  /** Share of recommended events that past draws say this rank would have got into. */
  evidencedShare: number;
  /** Events shown apart as a stretch, because past draws closed above this rank. */
  stretchCount: number;
  distinctStates: number;
  distinctRungs: number;
  monthsSpanned: number;
  /** The most recommended events starting inside any 30 days. */
  busiestThirtyDays: number;
  /** Share of recommended events in the child's home state, or null with no home state. */
  homeShare: number | null;
  /** Share of reasons that state at least one concrete fact about their event. */
  specificShare: number;
  /** Distinct reason shapes divided by reasons: 1 is all different, near 0 is a template. */
  reasonVariety: number;
  meanReasonWords: number;
  /** Days from today to the first recommended event, or null with none. */
  daysToFirst: number | null;
}

export interface Score {
  violations: Violations;
  violationTotal: number;
  diagnostics: Diagnostics;
}

const rungIndex = (ladder: string | undefined): number =>
  ladder ? (AITA_LADDER_ORDER as readonly string[]).indexOf(ladder) : -1;

const span = (event: { startDate: string; endDate?: string }) => {
  const start = dayNumber(event.startDate);
  return { start, end: Math.max(start, dayNumber(event.endDate ?? event.startDate)) };
};

/** Clear days between two events, negative when they share a day. */
const clearDays = (
  a: { startDate: string; endDate?: string },
  b: { startDate: string; endDate?: string }
): number => {
  const [x, y] = [span(a), span(b)].sort((p, q) => p.start - q.start) as [
    { start: number; end: number },
    { start: number; end: number },
  ];
  return y.start - x.end - 1;
};

const MONTHS = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
const DATE_WORDS = new RegExp(`\\b\\d{1,2}\\s${MONTHS}\\b`, "i");

/** A reason with its event's own facts blanked out, to see how many shapes there are. */
const shapeOf = (reason: string, candidate: Candidate): string => {
  let text = reason.toLowerCase();
  for (const word of [candidate.city, candidate.state, candidate.ladder, candidate.name]) {
    if (word) text = text.split(word.toLowerCase()).join("#");
  }
  return text
    .replace(/\d+/g, "0")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g, "M");
};

const isSpecific = (reason: string, candidate: Candidate, childState: string | null): boolean => {
  const text = reason.toLowerCase();
  const facts = [candidate.city, candidate.state, candidate.ladder, childState];
  return (
    facts.some((fact) => Boolean(fact) && text.includes(fact!.toLowerCase())) ||
    DATE_WORDS.test(reason)
  );
};

export function scoreResult(context: RecommendationContext, result: RecommendationResult): Score {
  const offered = new Map(context.candidates.map((candidate) => [candidate.slug, candidate]));
  const today = dayNumber(context.today);
  const room = Math.min(MAX_RECOMMENDED, context.allowanceLeft ?? MAX_RECOMMENDED);

  const violations: Violations = {
    notOffered: 0,
    duplicate: 0,
    overlap: 0,
    tooClose: 0,
    onTopOfPlan: 0,
    insideBlocked: 0,
    entriesClosed: 0,
    overAllowance: 0,
    tooManyRecommended: 0,
    tooManyConsider: 0,
    suggestedWithNoAllowance: 0,
    recommendedUnrealistic: 0,
    ungroundedReason: 0,
    emptyWithRoom: 0,
  };

  const seen = new Set<string>();
  const recommended: Candidate[] = [];
  const consider: Candidate[] = [];

  for (const item of result.items) {
    const candidate = offered.get(item.slug);
    if (!candidate) {
      violations.notOffered += 1;
      continue;
    }
    if (seen.has(item.slug)) {
      violations.duplicate += 1;
      continue;
    }
    seen.add(item.slug);
    (item.tier === "recommended" ? recommended : consider).push(candidate);
    if (item.tier === "recommended" && realismOf(candidate) !== "realistic") {
      violations.recommendedUnrealistic += 1;
    }

    if (!reasonIsGrounded(item.reason, candidate, context)) violations.ungroundedReason += 1;

    const when = span(candidate);
    if (
      context.blockedRanges.some((range) => {
        const from = dayNumber(range.from);
        const to = dayNumber(range.to);
        return when.start <= to && when.end >= from;
      })
    ) {
      violations.insideBlocked += 1;
    }
    if (candidate.deadline && dayNumber(candidate.deadline) < today) violations.entriesClosed += 1;
    if (context.committed.some((planned) => clearDays(candidate, planned) < 0)) {
      violations.onTopOfPlan += 1;
    }
  }

  // Recommended events must fit with each other and with what is planned, in full.
  for (let i = 0; i < recommended.length; i += 1) {
    for (let j = i + 1; j < recommended.length; j += 1) {
      const gap = clearDays(recommended[i]!, recommended[j]!);
      if (gap < 0) violations.overlap += 1;
      else if (gap < MIN_REST_DAYS) violations.tooClose += 1;
    }
    for (const planned of context.committed) {
      const gap = clearDays(recommended[i]!, planned);
      // Sharing a day with the plan is counted once, as onTopOfPlan, above.
      if (gap >= 0 && gap < MIN_REST_DAYS) violations.tooClose += 1;
    }
  }

  if (recommended.length > room) violations.overAllowance += 1;
  if (recommended.length > MAX_RECOMMENDED) violations.tooManyRecommended += 1;
  if (consider.length > MAX_CONSIDER) violations.tooManyConsider += 1;
  // With no entry left, an option is not an option: the child cannot be entered in it.
  if (room === 0 && recommended.length + consider.length > 0)
    violations.suggestedWithNoAllowance += 1;
  if (recommended.length === 0 && room > 0 && context.candidates.length > 0) {
    // The rules may genuinely have nothing that fits around the plan, so this is only
    // a violation when at least one candidate would have fitted on its own.
    const somethingFits = context.candidates.some(
      (candidate) =>
        !context.committed.some((planned) => clearDays(candidate, planned) < MIN_REST_DAYS)
    );
    if (somethingFits) violations.emptyWithRoom += 1;
  }

  // ─── Diagnostics ───────────────────────────────────────────────────────────
  const starts = recommended.map((candidate) => span(candidate).start).sort((a, b) => a - b);
  const busiest = starts.reduce(
    (most, start) => Math.max(most, starts.filter((s) => s >= start && s < start + 30).length),
    0
  );
  const reasons = result.items
    .filter((item) => offered.has(item.slug))
    .map((item) => ({ reason: item.reason, candidate: offered.get(item.slug)! }));

  const reachCount = recommended.filter((candidate) => rungIndex(candidate.ladder) >= 2).length;
  const homeCount = recommended.filter((candidate) => candidate.inHomeState).length;

  const diagnostics: Diagnostics = {
    recommended: recommended.length,
    consider: consider.length,
    reachCount,
    reachShare: recommended.length ? reachCount / recommended.length : 0,
    evidencedShare: recommended.length
      ? recommended.filter((candidate) => candidate.reach === "likely").length / recommended.length
      : 0,
    stretchCount: result.items.filter((item) => item.tier === "reach").length,
    distinctStates: new Set(recommended.map((c) => c.state).filter(Boolean)).size,
    distinctRungs: new Set(recommended.map((c) => c.ladder).filter(Boolean)).size,
    monthsSpanned: new Set(recommended.map((c) => new Date(c.startDate).toISOString().slice(0, 7)))
      .size,
    busiestThirtyDays: busiest,
    homeShare: context.child.state && recommended.length ? homeCount / recommended.length : null,
    specificShare: reasons.length
      ? reasons.filter(({ reason, candidate }) =>
          isSpecific(reason, candidate, context.child.state)
        ).length / reasons.length
      : 0,
    reasonVariety: reasons.length
      ? new Set(reasons.map(({ reason, candidate }) => shapeOf(reason, candidate))).size /
        reasons.length
      : 0,
    meanReasonWords: reasons.length
      ? reasons.reduce((sum, { reason }) => sum + reason.split(/\s+/).filter(Boolean).length, 0) /
        reasons.length
      : 0,
    daysToFirst: starts.length ? starts[0]! - today : null,
  };

  const violationTotal = Object.values(violations).reduce((sum, value) => sum + value, 0);
  return { violations, violationTotal, diagnostics };
}
