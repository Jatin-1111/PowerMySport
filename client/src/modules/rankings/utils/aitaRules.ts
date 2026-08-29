/**
 * What a ranking number actually does, under AITA's own rules.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * "Rank 312 of 1,602" is a measurement. It is not an answer. The question a
 * parent is really asking is *what happens next* — which tournaments the child
 * can enter, how many they are allowed to play, and what would change if the
 * number moved. Everything else on these pages is derived from the lists we
 * mirror; this is the one place where an outside rule set is stated, because
 * without it the numbers stay abstract.
 *
 * ── Provenance, and why it is stamped on screen ──────────────────────────────
 * Every fact below comes from AITA's junior tournament structure document. We
 * cannot re-derive any of it from the ranking lists, so it cannot be checked
 * automatically the way the rest of the page can. That asymmetry is the reason
 * `RULES_SOURCE` is exported and rendered next to anything sourced from here,
 * rather than the copy silently claiming the same authority as a computed figure.
 *
 * ── The 2026 revision, and what it corrected ─────────────────────────────────
 * This file was written against the 2020 structure document. AITA published a
 * replacement effective 01 January 2026, found when the ranking mirror was
 * repointed at their new platform, and **two of the rules stated here were
 * wrong**:
 *
 *   · The Talent Series bar is the top **75**, not the top 150.
 *   · Championship Series has **no ranking bar at all** — "There will be no
 *     restriction in Championship Series. All ranked players can play
 *     irrespective of their rank." We were telling parents the top 75 were shut
 *     out of it.
 *
 * Both are quoted from the 2026 text. Unchanged and re-verified against it: the
 * annual caps (18/25/30, unlimited at U-18), that playing up spends one shared
 * allowance, the calendar-year window, and the best-8-plus-25%-doubles formula.
 *
 * New in 2026 and now modelled: there are no Talent Series events at U-18 at
 * all, so the bar is moot in that bracket.
 *
 * The lesson worth keeping: an outside rule set with no automatic check needs a
 * date on it and a periodic re-read. If AITA revises again, this file is the
 * single place to change — do not scatter cut-offs into components.
 */

export const RULES_SOURCE = {
  label: "AITA Junior Tournament Structure, effective 1 January 2026",
  href:
    "https://www.aita.hitcourt.com/documents/" +
    "Rules_Collated_AITA_Junior_Circuit_Tournaments_2026.pdf",
} as const;

/** Junior age brackets are `U-12`…`U-18`; open-age lists have none of these rules. */
export const isJuniorBracket = (subcategory: string): boolean =>
  /^U-\d+$/i.test(subcategory.trim());

/**
 * How many tournaments a player may enter in a year, by bracket.
 *
 * Playing up draws from the same allowance — a U-14 who also enters U-16 events
 * spends one budget, not two — which is exactly the sort of thing a parent
 * planning a season needs told once, plainly.
 */
const ANNUAL_ENTRY_CAP: Record<string, number> = {
  "U-12": 18,
  "U-14": 25,
  "U-16": 30,
};

export const annualEntryCap = (subcategory: string): number | null =>
  ANNUAL_ENTRY_CAP[subcategory.trim().toUpperCase()] ?? null;

/**
 * The reverse gate: doing well *closes* the entry level.
 *
 * This is the least intuitive rule in Indian junior tennis and the one that
 * surprises parents most — a rank good enough to be worth celebrating is also
 * the rank that bars the child from the events they have been winning.
 *
 * There is exactly one such gate, which is the correction the 2026 document
 * forced. Championship Series has no rank bar: "There will be no restriction in
 * Championship Series. All ranked players can play irrespective of their rank."
 */
const TALENT_SERIES_BAR_RANK = 75;

/**
 * Brackets where Talent Series exists at all.
 *
 * 2026: "There will be no Talent Series tournaments for the Under 18 age group."
 * So at U-18 there is no entry level to be shut out of, and a U-18 in the top 75
 * must not be told Talent Series has closed to them — it was never open.
 */
const TALENT_SERIES_BRACKETS = new Set(["U-12", "U-14", "U-16"]);

const hasTalentSeries = (subcategory: string): boolean =>
  TALENT_SERIES_BRACKETS.has(subcategory.trim().toUpperCase());

export interface EntryStatus {
  /** Levels this rank is barred from. Empty means no ranking-based bar. */
  closed: readonly string[];
  /** One line, safe to use as a heading. */
  summary: string;
  /** Two sentences of context. */
  detail: string;
  /**
   * The rank at which the next gate closes, and which level it closes. Null once
   * every gate has already been passed — there is nothing further to warn about.
   */
  nextGate: { rank: number; level: string } | null;
}

/**
 * What this rank opens and closes, or null where the rules do not apply.
 *
 * Deliberately phrased around what is *closed*. AITA's published rules bar the
 * top of a list from the lower rungs; they do not promise anyone entry to the
 * higher ones, where draws are cut by ranking and a place is earned rather than
 * granted. Saying "Super Series is open to you" would be us inventing a
 * guarantee the source never made.
 */
export function entryStatus(rank: number, subcategory: string): EntryStatus | null {
  if (!isJuniorBracket(subcategory)) return null;
  if (!Number.isFinite(rank) || rank < 1) return null;

  // U-18 has no Talent Series to be barred from, so there is no gate to report
  // and nothing to warn about at any rank.
  if (!hasTalentSeries(subcategory)) {
    return {
      closed: [],
      summary: "No ranking-based entry bars in this age group",
      detail:
        "Under 18 has no Talent Series events, and Championship Series has no " +
        "ranking bar — so every level of the circuit is open to enter at any rank.",
      nextGate: null,
    };
  }

  if (rank <= TALENT_SERIES_BAR_RANK) {
    return {
      closed: ["Talent Series"],
      summary: "Talent Series is closed in this age group",
      detail:
        `AITA bars the top ${TALENT_SERIES_BAR_RANK} of an age group from Talent ` +
        "Series. Every other level stays open to enter — Championship Series has " +
        "no ranking bar at all.",
      nextGate: null,
    };
  }

  return {
    closed: [],
    summary: "No ranking-based entry bars at this rank",
    detail:
      "Every level of the AITA junior circuit is open to enter. That changes inside " +
      `the top ${TALENT_SERIES_BAR_RANK}, where Talent Series closes for this age group.`,
    nextGate: { rank: TALENT_SERIES_BAR_RANK, level: "Talent Series" },
  };
}

/**
 * Talent Series is zone-restricted, which is a gate a parent hits in practice
 * and which no rank explains.
 *
 * 2026: "TS tournaments taking place in a particular zone will be open to
 * players registered from that zone only. No player can play a tournament in a
 * zone other than in which he is registered in."
 */
export const TALENT_SERIES_ZONE_RULE =
  "Talent Series events are open only to players registered in that zone — a " +
  "player cannot enter one outside their own zone.";

/**
 * The eligibility bands as a standalone table, for the list page.
 *
 * The per-player form above answers "what about my child". This answers "what do
 * these numbers mean at all", which is what someone reading a list of 1,602
 * strangers is asking.
 */
/**
 * The junior ladder, lowest rung first, each with what it actually means.
 *
 * Named because the gates below are stated in terms of "Talent Series" and
 * "Championship Series", and a parent new to the circuit has no way to know
 * whether those are big tournaments or small ones — which makes a sentence like
 * "Talent Series is closed" impossible to react to. Two words of gloss turns the
 * rule into information.
 */
export const JUNIOR_LADDER = [
  { name: "Talent Series", plain: "the entry level — where most players start" },
  { name: "Championship Series", plain: "the next step up, run state by state" },
  { name: "Super Series", plain: "national-level events, harder to get into" },
  { name: "National Series", plain: "the level below the national championships" },
  { name: "Nationals", plain: "the national championships" },
  { name: "ITF Junior", plain: "international junior events" },
] as const;

export const ENTRY_BANDS = [
  {
    range: "Rank 1 – 75",
    effect: "Talent Series closed — every other level open to enter",
  },
  {
    range: "Rank 76 and below",
    effect: "No ranking-based bars — every level open to enter",
  },
] as const;

/**
 * How the points on these lists are earned, in words a parent can hold.
 *
 * "Best 8 singles over a rolling 52 weeks plus 25% of best 8 doubles" is how the
 * federation says it and how the first draft of this page said it. Every part of
 * that needs decoding: which eight, why eight, why a quarter, and what happens to
 * the ninth. Two plain sentences say the same thing and can be read once.
 */
export const POINTS_FORMULA =
  "Only a player's 8 best tournament results from the last 12 months are counted — " +
  "a bad result never costs points, and results older than a year drop off. " +
  "Doubles counts too, but only a quarter of it.";
