import { clearDaysBetween, dayNumber } from "@powermysport/shared-types";
import { z } from "zod";
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
    context.child.rank,
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

const isGrounded = (text: string, allowed: Set<number>): boolean =>
  !UNGROUNDED.test(text) && numbersIn(text).every((value) => allowed.has(value));

const byStart = (a: Candidate, b: Candidate): number =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

/**
 * The model's answer, made safe. Null when nothing usable is left, which the
 * caller treats as "use the rules".
 */
export function validateModelOutput(
  raw: unknown,
  context: RecommendationContext,
  now: Date
): RecommendationResult | null {
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return null;

  const bySlug = new Map(context.candidates.map((candidate) => [candidate.slug, candidate]));
  const room = Math.min(MAX_RECOMMENDED, context.allowanceLeft ?? MAX_RECOMMENDED);

  const recommended: Array<{ candidate: Candidate; reason: string }> = [];
  const consider: Array<{ candidate: Candidate; reason: string }> = [];
  const seen = new Set<string>();

  for (const pick of parsed.data.picks) {
    const candidate = bySlug.get(pick.slug);
    // An event the rules did not allow, or one made up: gone.
    if (!candidate || seen.has(candidate.slug)) continue;
    seen.add(candidate.slug);

    const cleaned = tidy(pick.reason);
    const reason = isGrounded(cleaned, allowedNumbers(candidate, context))
      ? cleaned
      : reasonFor(candidate, context.effectiveGoal, context);

    const onTopOfPlan = context.committed.some(
      (other) => conflictBetween(candidate, other) === "overlap"
    );
    const fits =
      !context.committed.some((other) => conflictBetween(candidate, other)) &&
      !recommended.some((other) => conflictBetween(candidate, other.candidate));

    if (pick.tier === "recommended" && recommended.length < room && fits) {
      recommended.push({ candidate, reason });
    } else if (!onTopOfPlan && consider.length < MAX_CONSIDER) {
      // Over the allowance, or too close to something chosen: still an option,
      // just not one to book alongside the rest.
      consider.push({ candidate, reason });
    }
  }

  // A season with nothing recommended is not an answer, unless the allowance is
  // genuinely spent.
  if (recommended.length === 0 && room > 0) return null;

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

  return {
    source: "ai",
    generatedAt: now.toISOString(),
    goal: context.goal,
    summary: isGrounded(summary, everything) ? summary : summaryFor(context, recommended.length),
    items,
    notes: notesFor(context),
  };
}
