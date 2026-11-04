import {
  JUNIOR_LADDER,
  MIN_REST_DAYS,
  clearDaysBetween,
  dayNumber,
} from "@powermysport/shared-types";
import { AITA_LADDER_ORDER } from "../../../shared/services/aita/editionSeries";
import type { SeasonGoal } from "../../models/SeasonPlan";
import {
  MAX_CONSIDER,
  MAX_RECOMMENDED,
  MAX_REACH,
  type Candidate,
  type RecommendationContext,
  type RecommendationItem,
  type RecommendationResult,
} from "./types";

/**
 * The season, built by code.
 *
 * ── Why code and not a model ────────────────────────────────────────────────
 * Choosing events so that none overlaps, each has rest around it, the yearly allowance
 * holds, the plan already made is respected and the budget is kept is a small constraint
 * problem, and code solves it exactly and in a millisecond. A model asked to do it
 * clashed its own picks, and the validator had to repair the answer after the fact. So
 * code builds the season and the model, if it is available, only words it. The same
 * season is shown either way, and it is the same every time it is asked for.
 *
 * ── The steps ───────────────────────────────────────────────────────────────
 * 1. Sort every event by whether the child would REALISTICALLY get in, judged by who got
 *    in at past events of the same level (`reach` on the candidate):
 *      realistic   enough of the past main draws took this rank, or the level is not cut
 *                  by ranking and there is no history to contradict that
 *      qualifying  this rank would mostly have meant the qualifying draw
 *      uncertain   the level is cut by ranking and we hold no past draws for it, so we
 *                  can neither promise a place nor rule one out
 *      reach       past draws of this level closed above this rank, in most events
 * 2. From the realistic events, choose the best set (below).
 * 3. The rest of the realistic ones, then the qualifying and uncertain ones, then (if
 *    asked for) older age groups, become the options. The reach events are listed apart,
 *    never as picks.
 *
 * ── What the evidence showed, and why "uncertain" exists ────────────────────
 * It was assumed that any level above Championship Series would shut out a middling rank.
 * The first real lists (2026-10-09) say otherwise: National Series main draws closed at
 * ranks 318 to 1,454 for under-14 boys, 477 to 665 for under-16 boys. Most of the pool
 * gets in. So a level is NOT judged out of reach because of its name, only because its past
 * draws closed above the rank. Where there are no past draws (Super Series and the
 * Nationals had none finished on the current platform) the honest answer is "not certain",
 * which is an option with a plain warning and never a pick.
 *
 * ── Choosing the best set ───────────────────────────────────────────────────
 * Each realistic event gets a score for the parent's goal. The chosen set maximises the
 * total score subject to what is HARD: no two events share a day or leave under two clear
 * days, none sits on or too near the plan, no more than the yearly entries left. The
 * budget is SOFT: events are kept within it where that can be done, and if nothing can,
 * the best season is still shown and says it is over. Rest between events is a mild
 * preference beyond the hard minimum (a week apart reads better than two days), and so is
 * not playing the same surface back to back. Searched exactly (dynamic programming over
 * events in date order), so "the best" is the best, and the answer never depends on the
 * order the calendar happened to list things in.
 *
 * The scores are plain and written down here on purpose. They are a starting position to
 * be tuned against the evaluation harness (`server/src/evals`), not facts about tennis.
 */

export const rungOf = (candidate: Pick<Candidate, "ladder">): number =>
  candidate.ladder ? (AITA_LADDER_ORDER as readonly string[]).indexOf(candidate.ladder) : -1;

/** Above Championship Series, where draws are cut by ranking. */
const isCutByRanking = (candidate: Pick<Candidate, "ladder">): boolean => rungOf(candidate) >= 2;

const byDate = (a: Candidate, b: Candidate): number =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime() || a.slug.localeCompare(b.slug);

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

// ─── Realistic, qualifying, reach ─────────────────────────────────────────────

export type Realism = "realistic" | "qualifying" | "uncertain" | "reach";

/** Where an event belongs for this child. An event with no verdict is judged by its level. */
export function realismOf(candidate: Candidate): Realism {
  switch (candidate.reach) {
    case "likely":
      return "realistic";
    case "qualifying":
      return "qualifying";
    case "unlikely":
      return "reach";
    default:
      // "no-evidence", or no verdict at all. Championship Series and below take everyone
      // who enters, by AITA's own 2026 rules. Above it a place is earned by ranking, and
      // with no past draws to say where it closes we say we do not know.
      return isCutByRanking(candidate) ? "uncertain" : "realistic";
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/** Every weight in one place. Tuned against the evaluation harness, not against tennis. */
export const WEIGHTS = {
  /** So that every realistic event is worth playing and a fuller season beats a thinner one. */
  base: 50,
  /** Points goal: per level of the circuit above Talent Series. */
  perRung: 10,
  /** Experience goal: Talent and Championship Series, where entry is not cut by ranking. */
  entryLevel: 25,
  /** Home goal: in the child's own state. */
  inHomeState: 30,
  /** Home goal: how much cheaper than the dearest option, scaled to this much. */
  cheaper: 15,
  /** Fewer than this many clear days between two picks is a mild penalty. */
  comfortableGap: 7,
  tightGap: 3,
  /** The same surface twice running. */
  sameSurface: 2,
} as const;

function scoreFor(
  candidate: Candidate,
  goal: SeasonGoal,
  range: { min: number; max: number } | null
): number {
  let score: number = WEIGHTS.base;
  const rung = rungOf(candidate);
  if (goal === "points") score += Math.max(0, rung) * WEIGHTS.perRung;
  if (goal === "experience" && rung >= 0 && rung <= 1) score += WEIGHTS.entryLevel;
  if (goal === "home") {
    if (candidate.inHomeState) score += WEIGHTS.inHomeState;
    if (candidate.cost && range && range.max > range.min) {
      score += ((range.max - candidate.cost.high) / (range.max - range.min)) * WEIGHTS.cheaper;
    }
  }
  return score;
}

/** What it costs, in the budget's unit, to put two events next to each other. */
function pairPenalty(a: Candidate, b: Candidate): number {
  const [earlier, later] = byDate(a, b) <= 0 ? [a, b] : [b, a];
  const gap = clearDaysBetween(earlier, later);
  let penalty = gap < WEIGHTS.comfortableGap ? WEIGHTS.tightGap : 0;
  if (a.surface && b.surface && a.surface.toLowerCase() === b.surface.toLowerCase()) {
    penalty += WEIGHTS.sameSurface;
  }
  return penalty;
}

// ─── Choosing the set ─────────────────────────────────────────────────────────

/**
 * The best compatible set of up to `room` events, exactly. `budgetUnits` is the money
 * left in units of `unit` rupees (null for no budget); an event with no cost estimate
 * costs nothing here, because it cannot be judged against the budget.
 */
function bestSet(
  pool: Candidate[],
  options: {
    room: number;
    goal: SeasonGoal;
    budgetUnits: number | null;
    unit: number;
  }
): Candidate[] {
  const { room, goal, budgetUnits, unit } = options;
  const events = [...pool].sort(byDate);
  const n = events.length;
  if (n === 0 || room <= 0) return [];

  const highs = events.flatMap((event) => (event.cost ? [event.cost.high] : []));
  const range = highs.length ? { min: Math.min(...highs), max: Math.max(...highs) } : null;
  const score = events.map((event) => scoreFor(event, goal, range));
  const units = events.map((event) =>
    budgetUnits !== null && event.cost ? Math.ceil(event.cost.high / unit) : 0
  );
  const B = budgetUnits ?? 0;

  const NEG = -Infinity;
  const value: Float64Array[][] = [];
  const parent: Int32Array[][] = [];
  for (let k = 0; k <= room; k += 1) {
    value.push(Array.from({ length: n }, () => new Float64Array(B + 1).fill(NEG)));
    parent.push(Array.from({ length: n }, () => new Int32Array(B + 1).fill(-1)));
  }

  for (let i = 0; i < n; i += 1) {
    if (units[i]! <= B) value[1]![i]![units[i]!] = score[i]!;
  }
  for (let k = 2; k <= room; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let p = 0; p < i; p += 1) {
        if (conflictBetween(events[p]!, events[i]!) !== null) continue;
        const penalty = pairPenalty(events[p]!, events[i]!);
        for (let b = units[i]!; b <= B; b += 1) {
          const before = value[k - 1]![p]![b - units[i]!]!;
          if (before === NEG) continue;
          const candidate = before + score[i]! - penalty;
          if (candidate > value[k]![i]![b]!) {
            value[k]![i]![b] = candidate;
            parent[k]![i]![b] = p;
          }
        }
      }
    }
  }

  let best = { k: 0, i: -1, b: 0, total: NEG };
  for (let k = 1; k <= room; k += 1) {
    for (let i = 0; i < n; i += 1) {
      for (let b = 0; b <= B; b += 1) {
        if (value[k]![i]![b]! > best.total) best = { k, i, b, total: value[k]![i]![b]! };
      }
    }
  }
  if (best.i < 0) return [];

  const chosen: Candidate[] = [];
  let { k, i, b } = best;
  while (k >= 1 && i >= 0) {
    chosen.push(events[i]!);
    const previous = parent[k]![i]![b]!;
    b -= units[i]!;
    i = previous;
    k -= 1;
  }
  return chosen.reverse();
}

// ─── Words ────────────────────────────────────────────────────────────────────

const GLOSS = new Map<string, string>(JUNIOR_LADDER.map((rung) => [rung.name, rung.plain]));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Oct", the way a parent says it. */
export const shortDate = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

/**
 * One or two short sentences built only from the calendar, AITA's rules and what past
 * events showed. Also what stands in for a model's sentence that fails validation, so it
 * must stand on its own. Costs are never named here: they belong to the cost lines.
 */
export function reasonFor(
  candidate: Candidate,
  goal: SeasonGoal,
  context: Pick<RecommendationContext, "child">,
  tier: RecommendationItem["tier"] = "recommended"
): string {
  if (tier === "reach") {
    return (
      candidate.reachText ??
      `${candidate.ladder ?? "This level"} is cut by ranking, so a place is earned, and we hold too little history to say where it closes.`
    );
  }
  if (candidate.older) {
    return `${candidate.ladder ?? "This event"} in an older age group. It spends the same yearly entries as the child's own group.`;
  }
  if (tier === "consider" && candidate.reach === "qualifying" && candidate.reachText) {
    return candidate.reachText;
  }
  if (tier === "consider" && realismOf(candidate) === "uncertain") {
    return `${candidate.ladder} is cut by ranking and we hold no past draws for it, so a place is not certain.`;
  }

  const rung = rungOf(candidate);
  let head: string;
  if (goal === "home") {
    head = candidate.inHomeState
      ? `In ${candidate.state}, where ${context.child.firstName} is registered.`
      : `Outside ${context.child.state ?? "their home state"}, but open to enter.`;
  } else if (goal === "experience") {
    head =
      rung >= 0 && rung <= 1
        ? `${candidate.ladder}: entry is not cut by ranking at this level.`
        : `${candidate.ladder ?? "This event"}: the draw is cut by ranking, so a place is earned.`;
  } else {
    const gloss = candidate.ladder ? GLOSS.get(candidate.ladder) : undefined;
    head =
      candidate.ladder && gloss ? `${candidate.ladder}: ${gloss}.` : "Open to enter at this rank.";
  }

  const tail: string[] = [];
  if (
    candidate.daysToDeadline !== null &&
    candidate.daysToDeadline >= 0 &&
    candidate.daysToDeadline <= 7 &&
    candidate.deadline
  ) {
    tail.push(`Entries close ${shortDate(candidate.deadline)}.`);
  } else if (candidate.surface) {
    tail.push(`${candidate.surface} courts.`);
  }
  return [head, ...tail].join(" ");
}

const GOAL_PHRASE: Record<SeasonGoal, string> = {
  points: "for the higher rungs of the circuit",
  experience: "for events where entry is not cut by ranking",
  home: "for events in their home state",
};

const rupees = (value: number): string => `₹${Math.round(value).toLocaleString("en-IN")}`;

/** Plain facts about what was left out, so a short list is never a mystery. */
export function notesFor(
  context: RecommendationContext,
  extra: { budget?: string[] } = {}
): string[] {
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
  if (skipped.dismissed > 0) {
    notes.push(
      `${skipped.dismissed} event${skipped.dismissed === 1 ? "" : "s"} you marked as not for you ${skipped.dismissed === 1 ? "is" : "are"} left out.`
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
  notes.push(...(extra.budget ?? []));
  return notes;
}

export function summaryFor(
  context: RecommendationContext,
  counts: { recommended: number; reach?: number }
): string {
  const reachLine =
    counts.reach && counts.reach > 0
      ? ` ${counts.reach} higher-level event${counts.reach === 1 ? " is" : "s are"} shown apart as a stretch.`
      : "";
  if (counts.recommended === 0) {
    return `Nothing open fits around the plan and your blocked dates right now.${reachLine}`;
  }
  const planned = context.committed.length;
  const around = planned > 0 ? `around the ${planned} already planned` : "into the weeks ahead";
  return `${counts.recommended} event${counts.recommended === 1 ? "" : "s"} fit ${around}, chosen ${GOAL_PHRASE[context.effectiveGoal]}.${reachLine}`;
}

// ─── The whole season ─────────────────────────────────────────────────────────

const urgent = (candidate: Candidate): boolean =>
  candidate.daysToDeadline !== null &&
  candidate.daysToDeadline >= 0 &&
  candidate.daysToDeadline <= 7;

export interface Season {
  recommended: Candidate[];
  consider: Candidate[];
  reach: Candidate[];
  /** Budget remarks, in words. */
  budgetNotes: string[];
}

/** Which events go in which tier, and why some were left out. Deterministic. */
export function planSeason(context: RecommendationContext): Season {
  const room = Math.min(MAX_RECOMMENDED, context.allowanceLeft ?? MAX_RECOMMENDED);
  // No entry left this year: nothing can be recommended and nothing is an option either.
  // An "option" the child cannot be entered in is not one (found by the evaluation harness).
  if (room === 0) return { recommended: [], consider: [], reach: [], budgetNotes: [] };

  const realistic: Candidate[] = [];
  const cautious: Candidate[] = [];
  const reach: Candidate[] = [];
  for (const candidate of context.candidates) {
    // On top of something already planned: not even an option.
    if (context.committed.some((planned) => conflictBetween(candidate, planned) === "overlap")) {
      continue;
    }
    const realism = realismOf(candidate);
    if (realism === "realistic") realistic.push(candidate);
    else if (realism === "qualifying" || realism === "uncertain") cautious.push(candidate);
    else reach.push(candidate);
  }

  // Close to something planned (under the rest days) is an option, not a pick.
  const fits = realistic.filter(
    (candidate) => !context.committed.some((planned) => conflictBetween(candidate, planned))
  );

  // The budget: what is left after what is already planned, judged by the dearest end of
  // each estimate so a season is not called affordable on its cheapest guess.
  const budgetNotes: string[] = [];
  const committedHigh = context.committed.reduce(
    (sum, planned) => sum + (planned.cost?.high ?? 0),
    0
  );
  const known = fits.filter((candidate) => candidate.cost).length;
  const remaining = context.budget === null ? null : context.budget - committedHigh;
  const unit = remaining === null ? 1 : Math.max(500, Math.ceil(Math.max(remaining, 1) / 300));
  const budgetUnits =
    remaining === null || known === 0 ? null : Math.max(0, Math.floor(remaining / unit));

  const unconstrained = bestSet(fits, {
    room,
    goal: context.effectiveGoal,
    budgetUnits: null,
    unit,
  });
  let recommended = unconstrained;
  if (budgetUnits !== null) {
    const within = bestSet(fits, { room, goal: context.effectiveGoal, budgetUnits, unit });
    if (within.length > 0) {
      recommended = within;
      const left = unconstrained.filter((event) => !within.includes(event)).length;
      if (left > 0) {
        budgetNotes.push(
          `${left} event${left === 1 ? " was" : "s were"} left out of the picks to keep within your ${rupees(context.budget!)} budget. Costs are estimates.`
        );
      }
    } else if (unconstrained.length > 0) {
      budgetNotes.push(
        `Even the cheapest events are over your ${rupees(context.budget!)} budget, so the best season is shown anyway. Costs are estimates.`
      );
    }
    const total =
      committedHigh + recommended.reduce((sum, event) => sum + (event.cost?.high ?? 0), 0);
    if (recommended.length > 0 && budgetNotes.length === 0) {
      budgetNotes.push(
        `Estimated travel and stay for the picks and the plan is up to ${rupees(total)}, within your ${rupees(context.budget!)} budget. Entry fees are not included.`
      );
    }
  } else if (context.budget !== null && fits.length > 0) {
    budgetNotes.push(
      "Costs could not be estimated for these events, so your budget was not used to choose them."
    );
  }

  const taken = new Set(recommended.map((event) => event.slug));
  const rest = [...realistic]
    .filter((candidate) => !taken.has(candidate.slug))
    .sort(
      (a, b) =>
        scoreFor(b, context.effectiveGoal, null) - scoreFor(a, context.effectiveGoal, null) ||
        byDate(a, b)
    );
  const optionPool = [...rest, ...cautious.sort(byDate), ...context.olderCandidates.sort(byDate)];
  const consider = optionPool
    .filter(
      (candidate) =>
        !context.committed.some((planned) => conflictBetween(candidate, planned) === "overlap")
    )
    .slice(0, MAX_CONSIDER);

  const stretch = [...reach]
    .sort((a, b) => rungOf(b) - rungOf(a) || byDate(a, b))
    .slice(0, MAX_REACH);

  return {
    recommended: [...recommended].sort(byDate),
    consider: [...consider].sort(byDate),
    reach: [...stretch].sort(byDate),
    budgetNotes,
  };
}

/** The whole answer, from rules alone. */
export function buildSeason(
  context: RecommendationContext,
  now: Date,
  fallbackReason?: RecommendationResult["fallbackReason"]
): RecommendationResult {
  const season = planSeason(context);
  const item = (candidate: Candidate, tier: RecommendationItem["tier"]): RecommendationItem => ({
    slug: candidate.slug,
    tier,
    reason: reasonFor(candidate, context.effectiveGoal, context, tier),
    ...(urgent(candidate) ? { urgent: true } : {}),
  });

  return {
    source: "rules",
    ...(fallbackReason ? { fallbackReason } : {}),
    generatedAt: now.toISOString(),
    goal: context.goal,
    summary: summaryFor(context, {
      recommended: season.recommended.length,
      reach: season.reach.length,
    }),
    items: [
      ...season.recommended.map((candidate) => item(candidate, "recommended")),
      ...season.consider.map((candidate) => item(candidate, "consider")),
      ...season.reach.map((candidate) => item(candidate, "reach")),
    ],
    notes: notesFor(context, { budget: season.budgetNotes }),
  };
}
