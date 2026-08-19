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
 * Every fact below comes from AITA's junior tournament structure document
 * (2020, still the governing text at the time of writing). We cannot re-derive
 * any of it from the ranking PDFs, so it cannot be checked automatically the way
 * the rest of the page can. That asymmetry is the reason `RULES_SOURCE` is
 * exported and rendered next to anything sourced from here, rather than the copy
 * silently claiming the same authority as a computed figure.
 *
 * If AITA revises the structure, this file is the single place to change — do
 * not scatter cut-offs into components.
 */

export const RULES_SOURCE = {
  label: "AITA Junior Tournament Structure, 2020",
  href: "https://aitatennis.com/",
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
 * The reverse gates: doing well *closes* the lower rungs.
 *
 * This is the least intuitive rule in Indian junior tennis and the one that
 * surprises parents most — a rank good enough to be worth celebrating is also
 * the rank that bars the child from the events they have been winning. Ordered
 * strictest first, because `entryStatus` returns the first that applies.
 */
const REVERSE_GATES = [
  {
    /** Inside the top 75: barred from Talent *and* Championship Series. */
    maxRank: 75,
    closed: ["Talent Series", "Championship Series"],
    summary: "Talent Series and Championship Series are closed in this age group",
    detail:
      "AITA bars the top 75 of an age group from Championship Series, and the top 150 " +
      "from Talent Series. The route from here is Super Series and above.",
  },
  {
    maxRank: 150,
    closed: ["Talent Series"],
    summary: "Talent Series is closed in this age group",
    detail:
      "AITA bars the top 150 of an age group from Talent Series. Championship Series " +
      "is still open, and stays open until the top 75.",
  },
] as const;

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

  const gate = REVERSE_GATES.find((g) => rank <= g.maxRank);
  if (gate) {
    // Inside the strictest band there is no further gate to reach.
    const stricter = REVERSE_GATES[0];
    return {
      closed: gate.closed,
      summary: gate.summary,
      detail: gate.detail,
      nextGate:
        gate === stricter
          ? null
          : { rank: stricter.maxRank, level: stricter.closed[1] ?? "Championship Series" },
    };
  }

  const first = REVERSE_GATES[REVERSE_GATES.length - 1]!;
  return {
    closed: [],
    summary: "No ranking-based entry bars at this rank",
    detail:
      "Every level of the AITA junior circuit is open to enter. That changes inside " +
      `the top ${first.maxRank}, where Talent Series closes for this age group.`,
    nextGate: { rank: first.maxRank, level: "Talent Series" },
  };
}

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
  { range: "Rank 1 – 75", effect: "Talent Series and Championship Series both closed" },
  { range: "Rank 76 – 150", effect: "Talent Series closed, Championship Series open" },
  { range: "Rank 151 and below", effect: "No ranking-based bars — every level open to enter" },
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
