import { JUNIOR_LADDER, MIN_REST_DAYS, clearDaysBetween } from "@powermysport/shared-types";
import { AITA_LADDER_ORDER } from "../../../shared/services/aita/editionSeries";
import type { SeasonGoal } from "../../models/SeasonPlan";
import {
  MAX_CONSIDER,
  MAX_RECOMMENDED,
  type Candidate,
  type RecommendationContext,
  type RecommendationItem,
  type RecommendationResult,
} from "./types";

/**
 * The recommender without the model.
 *
 * ── Why this is a full implementation and not a stub ────────────────────────
 * It is the fallback whenever Gemini is unavailable, over its daily limit, or
 * returns something that fails validation, and it is also the yardstick: the
 * model is only worth its cost if it improves on this. A parent must never see
 * an empty planner because an API key lapsed, so this has to be good enough to
 * ship on its own.
 *
 * Everything it says comes from the calendar and from AITA's published rules,
 * with no inference about fields, draws or strength of play that the data does
 * not hold. That restraint is why its reasons are short.
 */

const rungOf = (candidate: Candidate): number =>
  candidate.ladder ? (AITA_LADDER_ORDER as readonly string[]).indexOf(candidate.ladder) : -1;

const byDate = (a: Candidate, b: Candidate): number =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

/**
 * Best first, for the goal the parent chose.
 *
 *   points      the higher the rung of the circuit, the better
 *   experience  entry-level rungs first: AITA does not cut their draws by ranking
 *   home        events in the child's own state first
 *
 * Ties break to the earlier event, so the order is stable and explainable.
 */
export function orderForGoal(candidates: Candidate[], goal: SeasonGoal): Candidate[] {
  const copy = [...candidates];
  switch (goal) {
    case "points":
      return copy.sort((a, b) => rungOf(b) - rungOf(a) || byDate(a, b));
    case "experience": {
      // Talent and Championship Series (rungs 0 and 1) are the entry levels.
      const entryLevel = (c: Candidate) => (rungOf(c) >= 0 && rungOf(c) <= 1 ? 0 : 1);
      return copy.sort((a, b) => entryLevel(a) - entryLevel(b) || byDate(a, b));
    }
    case "home":
      return copy.sort((a, b) => Number(b.inHomeState) - Number(a.inHomeState) || byDate(a, b));
  }
}

/**
 * How two events sit against each other: they share a day, they leave too little
 * room, or they are fine. Symmetric, so callers need not sort the pair.
 */
export function conflictBetween(
  a: { startDate: string; endDate?: string | undefined },
  b: { startDate: string; endDate?: string | undefined }
): "overlap" | "tight" | null {
  const [earlier, later] =
    new Date(a.startDate).getTime() <= new Date(b.startDate).getTime() ? [a, b] : [b, a];
  const clear = clearDaysBetween(earlier, later);
  if (clear < 0) return "overlap";
  return clear < MIN_REST_DAYS ? "tight" : null;
}

/**
 * Split an ordered list into what to recommend and what to consider.
 *
 * Recommended events must fit together: no overlap and the rest days between
 * them, against each other and against what is already planned, and no more than
 * the child has yearly entries left. "Consider" events are alternatives, so they
 * may sit near a recommended one, but never on top of something already planned.
 */
export function pickSchedule(
  ordered: Candidate[],
  context: Pick<RecommendationContext, "committed" | "allowanceLeft">
): { recommended: Candidate[]; consider: Candidate[] } {
  const room = Math.min(MAX_RECOMMENDED, context.allowanceLeft ?? MAX_RECOMMENDED);
  const recommended: Candidate[] = [];

  for (const candidate of ordered) {
    if (recommended.length >= room) break;
    const clashes = [...context.committed, ...recommended].some((other) =>
      conflictBetween(candidate, other)
    );
    if (!clashes) recommended.push(candidate);
  }

  const taken = new Set(recommended.map((candidate) => candidate.slug));
  const consider: Candidate[] = [];
  for (const candidate of ordered) {
    if (consider.length >= MAX_CONSIDER) break;
    if (taken.has(candidate.slug)) continue;
    const onTopOfPlan = context.committed.some(
      (other) => conflictBetween(candidate, other) === "overlap"
    );
    if (!onTopOfPlan) consider.push(candidate);
  }
  return { recommended, consider };
}

// ─── Words ────────────────────────────────────────────────────────────────────

const GLOSS = new Map<string, string>(JUNIOR_LADDER.map((rung) => [rung.name, rung.plain]));

/**
 * One sentence of reasoning built only from the calendar and AITA's published
 * rules. Also what replaces a model's reason that fails validation, so it must
 * stand on its own.
 */
export function reasonFor(
  candidate: Candidate,
  goal: SeasonGoal,
  context: Pick<RecommendationContext, "child">
): string {
  let sentence: string;
  const rung = rungOf(candidate);

  if (goal === "home") {
    sentence = candidate.inHomeState
      ? `In ${candidate.state}, where ${context.child.firstName} is registered.`
      : `Outside ${context.child.state ?? "their home state"}, but open to enter.`;
  } else if (goal === "experience") {
    sentence =
      rung >= 0 && rung <= 1
        ? `${candidate.ladder}: entry is not cut by ranking at this level.`
        : `${candidate.ladder ?? "This event"}: the draw is cut by ranking, so a place is earned.`;
  } else {
    const gloss = candidate.ladder ? GLOSS.get(candidate.ladder) : undefined;
    sentence =
      candidate.ladder && gloss ? `${candidate.ladder}: ${gloss}.` : "Open to enter at this rank.";
  }

  return sentence;
}

const GOAL_PHRASE: Record<SeasonGoal, string> = {
  points: "for the higher rungs of the circuit",
  experience: "for events where entry is not cut by ranking",
  home: "for events in their home state",
};

/** Plain facts about what was left out, so a short list is never a mystery. */
export function notesFor(context: RecommendationContext): string[] {
  const notes: string[] = [];
  const { skipped, allowanceLeft } = context;
  if (skipped.blocked > 0) {
    notes.push(
      `${skipped.blocked} event${skipped.blocked === 1 ? "" : "s"} fall inside your blocked dates and were left out.`
    );
  }
  if (skipped.entriesClosed > 0) {
    notes.push(
      `${skipped.entriesClosed} event${skipped.entriesClosed === 1 ? " has" : "s have"} already closed entries.`
    );
  }
  if (allowanceLeft === 0) {
    notes.push("The yearly entry allowance for this age group is already used on the plan.");
  }
  if (context.goal === "home" && context.effectiveGoal !== "home") {
    notes.push(
      "Their home state is not on the ranking list, so events were chosen for match experience instead."
    );
  }
  return notes;
}

export function summaryFor(context: RecommendationContext, recommendedCount: number): string {
  if (recommendedCount === 0) {
    return "Nothing open fits around the plan and your blocked dates right now.";
  }
  const planned = context.committed.length;
  const around = planned > 0 ? `around the ${planned} already planned` : "into the weeks ahead";
  return `${recommendedCount} event${recommendedCount === 1 ? "" : "s"} fit ${around}, chosen ${GOAL_PHRASE[context.effectiveGoal]}.`;
}

/** The whole recommendation, from rules alone. */
export function baselineRecommend(
  context: RecommendationContext,
  now: Date,
  fallbackReason?: RecommendationResult["fallbackReason"]
): RecommendationResult {
  const ordered = orderForGoal(context.candidates, context.effectiveGoal);
  const { recommended, consider } = pickSchedule(ordered, context);

  // Chosen by score, shown by date: a season reads in the order it happens.
  recommended.sort(byDate);
  consider.sort(byDate);

  const items: RecommendationItem[] = [
    ...recommended.map((candidate) => ({
      slug: candidate.slug,
      tier: "recommended" as const,
      reason: reasonFor(candidate, context.effectiveGoal, context),
    })),
    ...consider.map((candidate) => ({
      slug: candidate.slug,
      tier: "consider" as const,
      reason: reasonFor(candidate, context.effectiveGoal, context),
    })),
  ];

  return {
    source: "rules",
    ...(fallbackReason ? { fallbackReason } : {}),
    generatedAt: now.toISOString(),
    goal: context.goal,
    summary: summaryFor(context, recommended.length),
    items,
    notes: notesFor(context),
  };
}
