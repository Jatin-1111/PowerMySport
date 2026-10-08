import { JUNIOR_LADDER, clearDaysBetween, dayNumber } from "@powermysport/shared-types";
import { z } from "zod";
import { INDIAN_STATE_NAMES } from "../../../constants/indianStates";
import { buildSeason, realismOf, summaryFor } from "./builder";
import { type Candidate, type RecommendationContext, type RecommendationResult } from "./types";

/**
 * Everything the model returns is checked here before a parent sees any of it.
 *
 * ── What the model is for now ───────────────────────────────────────────────
 * Code builds the season (`builder.ts`): which events, in which tier. The model is shown
 * that season and writes a sentence for each event and a line on its shape. So there is
 * nothing here to repair about WHICH events: a pick the season does not contain is
 * ignored, and a sentence for a pick the model left out is the code's own. What can still
 * go wrong is the wording, and that is what is checked.
 *
 * ── What can and cannot be checked ──────────────────────────────────────────
 * No code can prove a free-text sentence true. So each is held to cheap tests that catch
 * the failures that matter: a number that appears nowhere in the data (a made-up rank,
 * date or count), a place or level that belongs to a different event, and language that
 * promises or prices something the planner has no basis for. A sentence that fails is
 * replaced by the code's own, so the event survives and only the unverified words are
 * lost. The sentences for stretch events and for qualifying-only options are never the
 * model's: they say what past draws showed, and are not softened.
 */

const outputSchema = z.object({
  summary: z.string().min(1).max(400),
  picks: z
    .array(
      z.object({
        slug: z.string().min(1),
        reason: z.string().max(300),
      })
    )
    .max(30),
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
    // What past events showed, in the words that report it.
    ...numbersIn(candidate.reachText ?? ""),
    ...(candidate.daysToDeadline === null ? [] : [candidate.daysToDeadline]),
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

/**
 * What validation had to change, counted. Quality drift in the model shows up here
 * first: a model that starts writing sentences that fail the checks is visible as these
 * numbers rising long before a parent notices.
 */
export interface ValidationStats {
  /** Sentences the model returned, before any were ignored. */
  picks: number;
  /** Sentences for an event not in the season, or for the same event twice. */
  dropped: number;
  /** Sentences that failed the checks and were replaced by the code's own. */
  reasonsReplaced: number;
  /** Of those, how many named a place or level that belongs to a different event. */
  foreignNames: number;
  /** Events in the season the model wrote nothing for. */
  reasonsMissing: number;
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

/** Sentences that report what past draws showed are never the model's. */
const keepsOwnWords = (candidate: Candidate, tier: string): boolean =>
  tier === "reach" ||
  candidate.older === true ||
  candidate.reach === "qualifying" ||
  realismOf(candidate) === "uncertain";

/**
 * Whether the season has any sentence for the model to write. A season made only of stretch
 * events and qualifying-only options is worded entirely by code, and asking the model
 * would spend an allowance for nothing.
 */
export function hasWordableItems(
  items: Array<{ slug: string; tier: string }>,
  context: RecommendationContext
): boolean {
  const known = new Map(
    [...context.candidates, ...context.olderCandidates].map((candidate) => [
      candidate.slug,
      candidate,
    ])
  );
  return items.some((item) => {
    const candidate = known.get(item.slug);
    return candidate !== undefined && !keepsOwnWords(candidate, item.tier);
  });
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
    reasonsReplaced: 0,
    foreignNames: 0,
    reasonsMissing: 0,
    summaryReplaced: false,
    malformed: false,
  };
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return { result: null, stats: { ...stats, malformed: true } };
  stats.picks = parsed.data.picks.length;

  // The season, as code builds it. The model words this and changes none of it.
  const season = buildSeason(context, now);
  const known = new Map(
    [...context.candidates, ...context.olderCandidates].map((candidate) => [
      candidate.slug,
      candidate,
    ])
  );
  const inSeason = new Set(season.items.map((item) => item.slug));
  const universe = namedUniverse(context);

  const said = new Map<string, string>();
  for (const pick of parsed.data.picks) {
    if (!inSeason.has(pick.slug) || said.has(pick.slug)) stats.dropped += 1;
    else said.set(pick.slug, pick.reason);
  }

  let used = 0;
  const items = season.items.map((item) => {
    const candidate = known.get(item.slug)!;
    if (keepsOwnWords(candidate, item.tier)) return item;
    const sentence = said.get(item.slug);
    if (sentence === undefined) {
      stats.reasonsMissing += 1;
      return item;
    }
    const cleaned = tidy(sentence);
    const numbersOk = isGrounded(cleaned, allowedNumbers(candidate, context));
    const foreign = foreignName(cleaned, namesAllowedFor(candidate, context), universe);
    if (numbersOk && foreign === null) {
      used += 1;
      return { ...item, reason: cleaned };
    }
    stats.reasonsReplaced += 1;
    if (numbersOk) stats.foreignNames += 1;
    return item;
  });

  // An answer in which the model said nothing usable is not the model's answer.
  const wordable = items.filter((item) => !keepsOwnWords(known.get(item.slug)!, item.tier));
  if (wordable.length > 0 && used === 0) return { result: null, stats };

  const count = (tier: string) => items.filter((item) => item.tier === tier).length;
  const everything = new Set<number>([
    ...context.candidates.flatMap((candidate) => [...allowedNumbers(candidate, context)]),
    count("recommended"),
    count("consider"),
    count("reach"),
  ]);
  const summary = tidy(parsed.data.summary);
  const everyName = [
    ...context.candidates.flatMap((candidate) => namesAllowedFor(candidate, context)),
    ...LEVEL_NAMES,
  ];
  stats.summaryReplaced =
    !isGrounded(summary, everything) || foreignName(summary, everyName, universe) !== null;

  return {
    result: {
      ...season,
      source: "ai",
      summary: stats.summaryReplaced
        ? summaryFor(context, { recommended: count("recommended"), reach: count("reach") })
        : summary,
      items,
    },
    stats,
  };
}
