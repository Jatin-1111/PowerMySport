/**
 * Presentation helpers for the derived ranking analytics.
 *
 * The arithmetic here is deliberately trivial — every real derivation (movement,
 * state rank, benchmark tiers, the next rung up) is computed by the API from the
 * stored list, so the browser never has a second opinion about what a number
 * means. What lives here is only how to *say* it.
 */

import type { RankingBandProfile } from "./api";

/**
 * The six validated categorical slots, in the order they must be used.
 *
 * Utility classes rather than `var(--rank-series-N)` strings: Tailwind v4 removes
 * custom properties it cannot see referenced in CSS, and a variable that only
 * ever appears inside a JSX `style` attribute is invisible to it — the whole
 * palette rendered transparent before these were real classes. Written out in
 * full because Tailwind scans source text for class names and would not find one
 * assembled from a template literal.
 */
export const RANK_SERIES_CLASS = [
  "bg-rank-series-1",
  "bg-rank-series-2",
  "bg-rank-series-3",
  "bg-rank-series-4",
  "bg-rank-series-5",
  "bg-rank-series-6",
] as const;

/**
 * The background class for series `index`, in fixed order and never cycled.
 *
 * Past the sixth slot a seventh hue would be indistinguishable from one already
 * on screen under colour-vision deficiency, so the tail shares a neutral and the
 * values carry the identity instead. No real AITA list has come close: the
 * widest has five point columns before the total.
 */
export function seriesClass(index: number): string {
  return RANK_SERIES_CLASS[index] ?? "bg-muted-foreground";
}

/**
 * "2026-07-27T00:00:00.000Z" -> "27 Jul 2026"
 *
 * Lives here rather than beside the fetchers in `api.ts` because client
 * components need it: importing it from `api.ts` would pull the whole ranking
 * config and every fetch helper into the browser bundle to get one date
 * formatter. `api.ts` re-exports it, so existing callers are unaffected.
 */
export function formatAsOn(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const formatPoints = (value: number): string =>
  Number.isInteger(value)
    ? value.toLocaleString("en-IN")
    : value.toLocaleString("en-IN", { maximumFractionDigits: 1 });

/** "Top 25%", or "Top 1%" at the very front — never "Top 0%". */
export function percentileLabel(rank: number, listSize: number | null | undefined): string | null {
  if (!listSize || listSize <= 0) return null;
  return `Top ${Math.max(1, Math.ceil((rank / listSize) * 100))}%`;
}

/** "Top 100" / "No. 1" — a rung standing on its own, as a label or heading. */
export const tierLabel = (rank: number): string =>
  rank === 1 ? "No. 1" : `Top ${rank.toLocaleString("en-IN")}`;

/**
 * The same rung inside a sentence: "45 points from the top 100", "…from the top
 * spot". Lower-casing `tierLabel` instead produces "from the no. 1", which is
 * why this is a separate form rather than a call to `toLowerCase()`.
 */
export const tierPhrase = (rank: number): string =>
  rank === 1 ? "top spot" : `top ${rank.toLocaleString("en-IN")}`;

/**
 * The rank a given percentile starts at, so a list can state its own scale
 * once — "the top 10% is rank 165 or better" — instead of repeating a
 * percentile on every row.
 */
export const rankAtPercentile = (percent: number, listSize: number): number =>
  Math.max(1, Math.round((percent / 100) * listSize));

/**
 * The bracket as a number, so `U-16` sorts against `U-18` rather than beside it
 * as a string. Returns null for the open-age lists, which have no bracket at
 * all and must never be ordered as though they did.
 */
export function bracketAge(subcategory: string): number | null {
  const match = /^U-(\d+)$/i.exec(subcategory.trim());
  return match ? Number(match[1]) : null;
}

/**
 * Which of a player's lists is their *own* age group, and which they are
 * playing up in.
 *
 * A child can enter a bracket above their age but never one below it, so the
 * youngest bracket they appear on is their own by construction — no date of
 * birth needed, which matters here because we deliberately never hold one in a
 * readable form. Open-age lists are never treated as a home bracket: a fifteen
 * year old on the Men's list is the clearest case of playing up there is.
 *
 * Returns null when the player is on open-age lists only, where the distinction
 * does not exist and inventing one would mislabel an adult's main list.
 */
export function ownBracket(subcategories: readonly string[]): string | null {
  let best: { subcategory: string; age: number } | null = null;
  for (const subcategory of subcategories) {
    const age = bracketAge(subcategory);
    if (age === null) continue;
    if (!best || age < best.age) best = { subcategory, age };
  }
  return best?.subcategory ?? null;
}

/**
 * "in the top 20% in India" — the phrase that turns a rank into an answer.
 *
 * Held to whole percents and never below one, matching `percentileLabel`, so the
 * sentence and the chip on the same page cannot disagree. Null when there is no
 * list size to measure against, which is the honest output rather than a
 * confident-sounding guess.
 */
export function nationalStandingPhrase(
  rank: number,
  listSize: number | null | undefined,
): string | null {
  if (!listSize || listSize <= 0) return null;
  const percent = Math.max(1, Math.ceil((rank / listSize) * 100));
  // Past the halfway mark "top 80%" is technically true and reads as praise for
  // being near the bottom. Ranked at all is the achievement worth naming there —
  // roughly nine in ten registered players never appear on a list.
  if (percent > 50) return `ranked among the top ${listSize.toLocaleString("en-IN")} in India`;
  return `in the top ${percent}% in India`;
}

/**
 * Point-column labels come off the PDF header in printer's shorthand:
 * `BEST-Eight SING. PTS.`, `CUT FOR NO SHOW LATE WL`, `ITF QLY PTS`. They are
 * unreadable in a legend and differ per category, so they are tidied by rule
 * rather than by a lookup table — a category we have not seen yet still comes
 * out legible, and the raw label is kept as the title attribute either way.
 */
const ACRONYMS = new Set([
  "ITF",
  "ATP",
  "WTA",
  // World Tennis Tour — appears on the open-age lists as "ITF WTT MEN PTS. X 1".
  "WTT",
  "AITA",
  "ITN",
  "WL",
  "TTL",
  "GS",
  "QLY",
]);

/**
 * Order matters. The multi-word phrases run first, because the penalty column is
 * printed `POINTS CUT FOR NO SHOW LATE WL` — strip the noise words before
 * matching the phrase and it no longer matches anything.
 */
const WORD_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\bCUT FOR NO SHOW LATE WL\b/gi, "no-show and late-withdrawal cut"],
  [/\bNO SHOW\b/gi, "no-show"],
  [/\bBEST[- ]EIGHT\b/gi, "best 8"],
  [/\bBEST\b/gi, "best"],
  [/\bSING\b/gi, "singles"],
  [/\bDBLS\b/gi, "doubles"],
  [/\bQLY\b/gi, "qualifying"],
];

export function shortenPointLabel(raw: string): string {
  let label = raw;
  for (const [pattern, replacement] of WORD_REPLACEMENTS) {
    label = label.replace(pattern, replacement);
  }

  // "PTS." / "POINTS" appear on nearly every column and say nothing — the panel
  // is already about points.
  label = label.replace(/\b(?:PTS?|POINTS?)\b\.?/gi, " ");
  // Abbreviation dots are left behind by the substitutions above ("SING." became
  // "singles."). Digits keep theirs, since a real value can appear in a label.
  label = label.replace(/\.(?!\d)/g, " ");
  // The source prints "25 % PTS." with the percent detached.
  label = label.replace(/\s+%/g, "%");
  label = label.replace(/\s+/g, " ").trim();

  const words = label.split(" ").map((word) => {
    // Anything carrying a digit is left exactly as printed: age brackets (U-14),
    // dates (27-Jul-25) and bare numbers all lose meaning when case-folded, and
    // "u-14" in a legend looks like a typo.
    if (/\d/.test(word)) return word;
    const bare = word.replace(/[^A-Za-z]/g, "");
    // Known acronyms keep their capitals; anything else still shouting gets
    // sentence case, which reads better beside a legend swatch.
    if (bare.length > 0 && ACRONYMS.has(bare.toUpperCase()) && bare === bare.toUpperCase()) {
      return word;
    }
    if (word === word.toUpperCase()) return word.toLowerCase();
    return word;
  });

  const joined = words.join(" ").trim();
  if (!joined) return raw;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * The same column, said the way a parent would say it.
 *
 * `shortenPointLabel` tidies the printer's shorthand into something legible —
 * `BEST Eight SING. PTS.` becomes "Best 8 singles" — and that is the right level
 * of intervention for a table header sitting directly above the source's own
 * figures. It is not enough for a chart legend that has to stand alone:
 * "03-Aug-25 25% Asian U-16" is tidy and still tells a parent nothing.
 *
 * So this goes one step further and names what the column *is*. The leading date
 * is the source stamping its own file and carries no meaning for the reader, so
 * it goes. The two doubles columns must stay distinguishable — a list prints both
 * the raw doubles total and the quarter of it that actually counts — so the
 * distinction is spelled out rather than dropped.
 *
 * Kept separate from `shortenPointLabel` rather than replacing it: the table
 * header should still echo the words on the PDF a parent may be holding, and one
 * column named two different ways in two places reads as two columns.
 */
export function plainPointLabel(raw: string): string {
  // Derived rather than printed — "U-18" reads as jargon beside plain words.
  if (raw.startsWith(ROLLED_DOWN_PREFIX)) {
    const bracket = raw.slice(ROLLED_DOWN_PREFIX.length);
    return `${ROLLED_DOWN_PREFIX}${bracket.replace(/^U-/i, "Under-")}`;
  }

  // "03-Aug-25 25 % PTS. Asian U-16" — the source stamping the file it came from.
  // The trailing "X 1" / "X 2" is the federation's own multiplier notation and
  // means nothing to a reader; it is not a quantity they can act on.
  const undated = raw
    .replace(/\b\d{1,2}-[A-Za-z]{3}-\d{2}\b/g, " ")
    .replace(/\s+X\s*\d+\s*$/i, "")
    .trim();

  if (/no[- ]show/i.test(undated)) return "Penalty for pulling out";
  // Once the raw doubles column is dropped from the stack this is the only
  // doubles slice on screen, so it can take the plain name. That only a quarter
  // counts is a footnote on the panel, not a qualifier on every legend entry.
  if (/\b25\s*%/.test(undated) && /DBLS|DOUBLES/i.test(undated)) return "Doubles";
  if (/DBLS|DOUBLES/i.test(undated)) return "Doubles played (not counted)";
  if (/SING/i.test(undated)) return "Singles";

  const asian = /ASIAN\s+(U-?\d+)/i.exec(undated);
  if (asian) return `Asian ${asian[1]?.toUpperCase()} (international)`;
  // "WTT" is the World Tennis Tour. Three capitals a reader cannot expand are
  // not a label, and this one sits next to two other ITF columns.
  if (/\bWTT\b/i.test(undated)) return "ITF World Tennis Tour (international)";
  if (/\bITF\b/i.test(undated)) return `${shortenPointLabel(undated)} (international)`;
  if (/\bATP\b|\bWTA\b/i.test(undated)) return `${shortenPointLabel(undated)} (pro tour)`;
  if (/UNDER\s+MENS|UNDER\s+WOMENS/i.test(undated)) return "Played in the open-age list";

  const tidied = shortenPointLabel(undated);
  // The open-age lists' domestic column is printed as a bare "BEST Eight PTS.",
  // which tidies to "Best 8" — true, and meaningless beside three columns that
  // name their circuit. These are the AITA domestic results.
  if (/^best \d+$/i.test(tidied)) return "AITA tournaments";
  return tidied;
}

/**
 * The next age bracket up, whose whole total rolls into this one.
 *
 * Verified against live data 2026-08-15 across U-12/14/16/18 and Men's Singles:
 * a junior's total is their own-age results plus the *entire* total of the
 * bracket above, minus the no-show cut. It chains, because that bracket's total
 * already contains anything above it.
 */
export function nextBracketUp(subcategory: string): string | null {
  const age = bracketAge(subcategory);
  if (age === null) return null;
  return age < 18 ? `U-${age + 2}` : null;
}

export interface ExplainedTotal {
  /** Positive contributions, in stack order. Sums to `total` plus deductions. */
  slices: Array<{ label: string; value: number }>;
  deductions: Array<{ label: string; value: number }>;
  total: number;
}

/** Label for the rolled-down slice, so the reader knows where it came from. */
export const ROLLED_DOWN_PREFIX = "Playing up in ";

/**
 * Make the printed columns actually account for the total.
 *
 * ── The problem this exists to solve ─────────────────────────────────────────
 * The ranking sheet's point columns do **not** add up to the total it prints
 * beside them, and the shortfall is not small. The Boys Under-16 number one has
 * 1,291 points against columns totalling 250 — the chart built naively from
 * those columns was telling parents that 81% of the leader's score came from
 * nowhere, while implying the visible fifth was the whole story.
 *
 * Two separate causes, both fixed here:
 *
 *   1. **The raw doubles column is not part of the score.** The sheet prints
 *      both "BEST Eight DBLS. PTS." and "25% BEST Eight DBLS. PTS."; only the
 *      quarter counts. Stacking both double-counts doubles.
 *
 *   2. **The bracket above rolls down in full and is never printed.** A player
 *      in Under-16 who also plays Under-18 carries their entire Under-18 total
 *      into the Under-16 score. For the top of the list this is the single
 *      largest component, and it was invisible.
 *
 * ── Where this is computed, and why it still lives here ─────────────────────
 * The ingest now does both of these when a list publishes: it flags the raw
 * doubles column `isInformational` and appends the rolled-down slice, computed
 * per player before averaging rather than as a residual of the averages. So for
 * a current snapshot this function has nothing left to derive — it filters, adds
 * up, and finds a residual of zero.
 *
 * It stays because the browser reads two things the ingest has not touched:
 * snapshots stored before that shipped, which carry neither the flag nor the
 * slice, and the single-player band the player page builds from one row. Both
 * need the same arithmetic, and both are better served by one path that always
 * runs than by a branch that only runs sometimes and is therefore only tested
 * sometimes.
 *
 * The residual is what makes that possible: the identity is linear, so it holds
 * for a band average exactly as it does for one player, and it comes out at zero
 * when the work has already been done upstream.
 *
 * ── Why it can return null ───────────────────────────────────────────────────
 * If the residual comes out meaningfully negative, the model above is wrong for
 * this list — a column set changed, or a rule did. The honest response to "these
 * parts do not add up" is to draw nothing, not to draw a chart that is confidently
 * wrong. That check is also what makes this safe against future AITA changes.
 */
export function explainTotal(
  composition: ReadonlyArray<{
    label: string;
    average: number;
    isDeduction: boolean;
    isInformational?: boolean;
  }>,
  total: number,
  subcategory: string,
): ExplainedTotal | null {
  const deductions = composition
    .filter((slice) => slice.isDeduction && slice.average !== 0)
    .map((slice) => ({ label: slice.label, value: Math.abs(slice.average) }));

  const scoring = composition.filter((slice) => !slice.isDeduction);

  // The ingest marks this now. The regex below is the fallback for snapshots
  // stored before it did, and for the single-player band the player page builds
  // from a raw row, which has no flags on it at all.
  const hasQuarterDoubles = scoring.some(
    (slice) => /\b25\s*%/.test(slice.label) && /DBLS|DOUBLES/i.test(slice.label),
  );
  const counted = scoring.filter((slice) => {
    if (slice.isInformational) return false;
    if (!hasQuarterDoubles) return true;
    const isDoubles = /DBLS|DOUBLES/i.test(slice.label);
    const isQuarter = /\b25\s*%/.test(slice.label);
    return !(isDoubles && !isQuarter);
  });

  const countedSum = counted.reduce((sum, slice) => sum + slice.average, 0);
  const deducted = deductions.reduce((sum, slice) => sum + slice.value, 0);
  const residual = total - countedSum + deducted;

  // Band averages arrive rounded to one decimal, so a few tenths of drift across
  // four columns is arithmetic, not disagreement.
  const tolerance = Math.max(0.5, Math.abs(total) * 0.01);
  if (residual < -tolerance) return null;

  const slices = counted
    .filter((slice) => slice.average > 0)
    .map((slice) => ({ label: slice.label, value: slice.average }));

  const above = nextBracketUp(subcategory);
  if (residual > tolerance && above) {
    slices.push({ label: `${ROLLED_DOWN_PREFIX}${above}`, value: residual });
  }

  if (slices.length === 0) return null;
  return { slices, deductions, total };
}

/**
 * The slices that make up the stack — the deduction columns are not part of it.
 *
 * Every reader below tolerates a missing `composition`. These payloads are cached
 * for half an hour, so for the first half hour after a deploy the UI is reading
 * objects the previous version wrote.
 */
export const stackedSlices = (band: RankingBandProfile) =>
  (band.composition ?? []).filter((slice) => !slice.isDeduction && slice.average > 0);

export const deductionSlices = (band: RankingBandProfile) =>
  (band.composition ?? []).filter((slice) => slice.isDeduction && slice.average !== 0);

/**
 * One ordered list of every non-deduction column across the bands, so the same
 * source gets the same colour in every bar. Colour has to follow the column, not
 * its position within a particular band — a band where "Asian U-14" happens to
 * be zero must not shift the rest of the stack onto different hues.
 */
export function compositionLegend(bands: RankingBandProfile[]): string[] {
  const seen: string[] = [];
  for (const band of bands) {
    for (const slice of band.composition ?? []) {
      if (slice.isDeduction) continue;
      if (!seen.includes(slice.label)) seen.push(slice.label);
    }
  }
  return seen;
}
