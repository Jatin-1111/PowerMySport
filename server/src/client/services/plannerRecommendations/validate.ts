import { JUNIOR_LADDER, clearDaysBetween, dayNumber } from "@powermysport/shared-types";
import { z } from "zod";
import { INDIAN_STATE_NAMES } from "../../../constants/indianStates";
import { conflictBetween, notesFor, reasonFor, summaryFor } from "./baseline";
import {
  MAX_CONSIDER,
  MAX_RECOMMENDED,
  type Candidate,
  type RecommendationContext,
  type RecommendationItem,
  type RecommendationResult,
} from "./types";

/**
 * Everything the model returns is checked here before a parent sees any of it.
 *
 * The prompt asks the model to behave; this file makes it so. A model that
 * invents an event, double-books a weekend or promises a place gets the invented
 * part dropped and the rest kept, and a response that cannot be used at all falls
 * back to the rule-based answer. Nothing the model writes reaches the page
 * unchecked.
 *
 * ── What can and cannot be checked ──────────────────────────────────────────
 * Which events were chosen, and whether they fit together, is checked exactly.
 * The free-text reasons cannot be: no code can prove a sentence true. So the
 * reasons are held to two cheap tests that catch the failures that matter, a
 * number that appears nowhere in the data (a made-up rank, date or count) and
 * language that promises or prices something the planner has no basis for. A
 * reason that fails is replaced by the deterministic one, so the pick survives
 * and only the unverified sentence is lost.
 */

const outputSchema = z.object({
  summary: z.string().min(1).max(400),
  picks: z
    .array(
      z.object({
        slug: z.string().min(1),
        tier: z.enum(["recommended", "consider"]),
        reason: z.string().max(300),
      })
    )
    .max(20),
});

/**
 * Language the planner has no grounds for. Costs belong to a later phase, where
 * they will be labelled estimates; a place in a draw is never promised; a claim
 * that one draw is stronger or easier than another is not in the data; and nor is
 * the child's gender, which the model must not guess from a first name.
 */
const UNGROUNDED = new RegExp(
  [
    "guarantee",
    "will get in",
    "will be selected",
    "sure to",
    "definitely",
    "₹",
    "\\brs\\b",
    "\\bcosts?\\b",
    "\\bfees?\\b",
    "\\bbudget",
    "\\bcheap",
    "\\bexpensive",
    "\\bprice",
    "stronger",
    "weaker",
    "\\beasy\\b",
    "\\beasier\\b",
    // The child's gender is not in the data, so these pronouns are a guess.
    "\\b(he|she|his|hers?|him|himself|herself)\\b",
  ].join("|"),
  "i"
);

/** The model's dashes become commas: this site does not use them in copy. */
const tidy = (text: string): string =>
  text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Spelled-out numbers, which a digits-only check would let through: "two days
 * after" is a claim about the calendar exactly as "2 days after" is. "One" is left
 * out because it is mostly a pronoun ("one of the events"), not a quantity.
 */
const NUMBER_WORDS: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
};
const NUMBER_WORD_PATTERN = new RegExp(
  String.raw`\b(${Object.keys(NUMBER_WORDS).join("|")})\b`,
  "gi"
);

const numbersIn = (text: string): number[] => [
  ...(text.match(/\d+/g) ?? []).map((token) => Number(token)),
  ...(text.match(NUMBER_WORD_PATTERN) ?? []).map((word) => NUMBER_WORDS[word.toLowerCase()]!),
];

/** Day, month number and year of an ISO date, as the model might quote them. */
const dateNumbers = (iso: string | null | undefined): number[] => {
  if (!iso) return [];
  const date = new Date(iso);
  return [date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear()];
};

/**
 * Every number a truthful reason could contain: the event's own dates, deadline
 * and grade, the child's rank, age list and allowance, the dates of what is
 * already planned, and the gaps between this event and each of them. A number
 * outside this set was not read from the data.
 */
function allowedNumbers(candidate: Candidate, context: RecommendationContext): Set<number> {
  const allowed = new Set<number>([
    ...dateNumbers(candidate.startDate),
    ...dateNumbers(candidate.endDate),
    ...dateNumbers(candidate.deadline),
    ...(typeof candidate.grade === "number" ? [candidate.grade] : []),
    ...(context.child.rank === null ? [] : [context.child.rank]),
    ...numbersIn(context.child.list),
    ...(context.allowanceLeft === null ? [] : [context.allowanceLeft]),
    context.committed.length,
    ...numbersIn(candidate.name),
  ]);

  const others = [
    ...context.committed,
    ...context.candidates.filter((c) => c.slug !== candidate.slug),
  ];
  for (const other of others) {
    // The clear days between the two, whichever comes first: "two days after".
    allowed.add(Math.abs(clearDaysBetween(candidate, other)));
    allowed.add(Math.abs(clearDaysBetween(other, candidate)));
    allowed.add(Math.abs(dayNumber(candidate.startDate) - dayNumber(other.startDate)));
    allowed.add(
      Math.abs(dayNumber(candidate.startDate) - dayNumber(other.endDate ?? other.startDate))
    );
    allowed.add(
      Math.abs(dayNumber(candidate.endDate ?? candidate.startDate) - dayNumber(other.startDate))
    );
    for (const value of [...dateNumbers(other.startDate), ...dateNumbers(other.endDate)])
      allowed.add(value);
  }
  return allowed;
}

// ─── Names ────────────────────────────────────────────────────────────────────
//
// A number check cannot catch "in Delhi" written about an event in Jaipur: there is no
// digit and no banned word in it. So the places and levels a reason names are held to the
// event it is about. This is a check against the data we hold, not a gazetteer: it knows
// the 36 states and every city and level that appears in the offered events, and it flags
// one of those named where it does not belong. A place outside everything we hold cannot
// be recognised, which is why the prompt still forbids adding any.

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrase = (name: string): RegExp => new RegExp(`\\b${escapeRegex(name)}\\b`, "gi");

const LEVEL_NAMES: string[] = JUNIOR_LADDER.map((rung) => rung.name);

/** The cities an event's name carries in brackets: "AITA CS7 (Sonipat)". */
const citiesInName = (name: string): string[] =>
  [...name.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]!.trim()).filter(Boolean);

/** Every place and level the data holds, each of which a reason could wrongly name. */
function namedUniverse(context: RecommendationContext): string[] {
  const names = new Set<string>([...INDIAN_STATE_NAMES, ...LEVEL_NAMES]);
  for (const candidate of context.candidates) {
    if (candidate.city) names.add(candidate.city);
    if (candidate.state) names.add(candidate.state);
    for (const city of citiesInName(candidate.name)) names.add(city);
  }
  for (const planned of context.committed) {
    for (const city of citiesInName(planned.name)) names.add(city);
  }
  if (context.child.state) names.add(context.child.state);
  return [...names];
}

/** The places and levels a reason about THIS event may truthfully name. */
function namesAllowedFor(candidate: Candidate, context: RecommendationContext): string[] {
  return [
    candidate.city,
    candidate.state,
    candidate.ladder,
    // "above Championship Series" is how the prompt asks a higher level to be explained.
    "Championship Series",
    context.child.state,
    ...citiesInName(candidate.name),
    // An event already planned may be named as the thing this one fits around.
    ...context.committed.flatMap((planned) => citiesInName(planned.name)),
  ].filter((name): name is string => Boolean(name));
}

/**
 * The first place or level the text names that is not in `allowed`, or null. Allowed
 * phrases are blanked first, so "New Delhi" is not mistaken for "Delhi".
 */
export function foreignName(text: string, allowed: string[], universe: string[]): string | null {
  let rest = text;
  // Longest first, so a longer allowed name is consumed before its own substring.
  for (const name of [...allowed].sort((a, b) => b.length - a.length)) {
    rest = rest.replace(phrase(name), " # ");
  }
  const allowedKeys = new Set(allowed.map((name) => name.toLowerCase()));
  for (const name of [...universe].sort((a, b) => b.length - a.length)) {
    if (allowedKeys.has(name.toLowerCase())) continue;
    if (phrase(name).test(rest)) return name;
  }
  return null;
}

const isGrounded = (text: string, allowed: Set<number>): boolean =>
  !UNGROUNDED.test(text) && numbersIn(text).every((value) => allowed.has(value));

/**
 * Whether a reason about one event passes the checks every reason must pass. Exported so
 * the evaluation harness can hold the rules-only answer and the model's answer to the same
 * test, instead of trusting that each was checked on the way in.
 */
export const reasonIsGrounded = (
  text: string,
  candidate: Candidate,
  context: RecommendationContext
): boolean =>
  isGrounded(tidy(text), allowedNumbers(candidate, context)) &&
  foreignName(tidy(text), namesAllowedFor(candidate, context), namedUniverse(context)) === null;

const byStart = (a: Candidate, b: Candidate): number =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

/**
 * The model's answer, made safe. Null when nothing usable is left, which the
 * caller treats as "use the rules".
 */
/**
 * What validation had to change, counted. Quality drift in the model shows up here
 * first: a model that starts inventing events, or writing reasons that fail the
 * checks, is visible as these numbers rising long before a parent notices.
 */
export interface ValidationStats {
  /** Picks the model returned, before any were dropped. */
  picks: number;
  /** Picks naming an event that was never offered, or naming one twice. */
  dropped: number;
  /** Recommended picks moved to "consider" (a clash, or over the allowance). */
  demoted: number;
  /** Reasons that failed the checks and were replaced by the rule-based one. */
  reasonsReplaced: number;
  /** Of those, how many named a place or level that belongs to a different event. */
  foreignNames: number;
  summaryReplaced: boolean;
  /** True when the answer was not the agreed shape at all. */
  malformed: boolean;
}

export function validateModelOutput(
  raw: unknown,
  context: RecommendationContext,
  now: Date
): RecommendationResult | null {
  return inspectModelOutput(raw, context, now).result;
}

/** As {@link validateModelOutput}, with a count of what it had to repair. */
export function inspectModelOutput(
  raw: unknown,
  context: RecommendationContext,
  now: Date
): { result: RecommendationResult | null; stats: ValidationStats } {
  const stats: ValidationStats = {
    picks: 0,
    dropped: 0,
    demoted: 0,
    reasonsReplaced: 0,
    foreignNames: 0,
    summaryReplaced: false,
    malformed: false,
  };
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return { result: null, stats: { ...stats, malformed: true } };
  stats.picks = parsed.data.picks.length;

  const bySlug = new Map(context.candidates.map((candidate) => [candidate.slug, candidate]));
  const universe = namedUniverse(context);
  const room = Math.min(MAX_RECOMMENDED, context.allowanceLeft ?? MAX_RECOMMENDED);

  const recommended: Array<{ candidate: Candidate; reason: string }> = [];
  const consider: Array<{ candidate: Candidate; reason: string }> = [];
  const seen = new Set<string>();

  for (const pick of parsed.data.picks) {
    const candidate = bySlug.get(pick.slug);
    // An event the rules did not allow, or one made up: gone.
    if (!candidate || seen.has(candidate.slug)) {
      stats.dropped += 1;
      continue;
    }
    seen.add(candidate.slug);

    const cleaned = tidy(pick.reason);
    const numbersOk = isGrounded(cleaned, allowedNumbers(candidate, context));
    const foreign = foreignName(cleaned, namesAllowedFor(candidate, context), universe);
    const grounded = numbersOk && foreign === null;
    if (!grounded) stats.reasonsReplaced += 1;
    if (numbersOk && foreign !== null) stats.foreignNames += 1;
    const reason = grounded ? cleaned : reasonFor(candidate, context.effectiveGoal, context);

    const onTopOfPlan = context.committed.some(
      (other) => conflictBetween(candidate, other) === "overlap"
    );
    const fits =
      !context.committed.some((other) => conflictBetween(candidate, other)) &&
      !recommended.some((other) => conflictBetween(candidate, other.candidate));

    if (pick.tier === "recommended" && recommended.length < room && fits) {
      recommended.push({ candidate, reason });
    } else if (room > 0 && !onTopOfPlan && consider.length < MAX_CONSIDER) {
      // Over the allowance, or too close to something chosen: still an option,
      // just not one to book alongside the rest.
      if (pick.tier === "recommended") stats.demoted += 1;
      consider.push({ candidate, reason });
    } else {
      stats.dropped += 1;
    }
  }

  // A season with nothing recommended is not an answer, unless the allowance is
  // genuinely spent.
  if (recommended.length === 0 && room > 0) return { result: null, stats };

  const items: RecommendationItem[] = [
    ...recommended.sort((a, b) => byStart(a.candidate, b.candidate)),
    ...consider.sort((a, b) => byStart(a.candidate, b.candidate)),
  ].map((entry, index) => ({
    slug: entry.candidate.slug,
    tier: index < recommended.length ? ("recommended" as const) : ("consider" as const),
    reason: entry.reason,
  }));

  const everything = new Set<number>([
    ...context.candidates.flatMap((candidate) => [...allowedNumbers(candidate, context)]),
    recommended.length,
    consider.length,
  ]);
  const summary = tidy(parsed.data.summary);
  // A summary speaks about the whole season, so it may name any place on offer, but not
  // one that is nowhere in the data.
  const everyName = [
    ...context.candidates.flatMap((candidate) => namesAllowedFor(candidate, context)),
    ...LEVEL_NAMES,
  ];
  stats.summaryReplaced =
    !isGrounded(summary, everything) || foreignName(summary, everyName, universe) !== null;

  return {
    result: {
      source: "ai",
      generatedAt: now.toISOString(),
      goal: context.goal,
      summary: stats.summaryReplaced ? summaryFor(context, recommended.length) : summary,
      items,
      notes: notesFor(context),
    },
    stats,
  };
}
