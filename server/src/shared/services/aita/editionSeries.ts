/**
 * Which rung of the circuit a tournament edition sits on, read from its name.
 *
 * ── Why the name, and not the `level` field ─────────────────────────────────
 * `TournamentEdition.level` exists and is populated on 24% of upcoming tennis
 * editions, and even where present it carries only "State", "National" or
 * "International". Those are not the ladder AITA actually runs — Talent Series,
 * Championship Series, Super Series, National Series, Nationals — so nothing
 * downstream can join `level` to the entry gates in the client's `aitaRules.ts`
 * or to any points table.
 *
 * The name can. Measured over all 279 tennis editions on 2026-09-17 there are
 * exactly 20 distinct name stems, and the series is in every one of them:
 * "AITA CS7 (Sonipat)", "AITA NS (Belagavi)", "AITA TS7 (Bengaluru)". The
 * `officialName` field confirms the expansion where it is present — "AITA
 * CHAMPIONSHIP SERIES TOURNAMENT (SONIPAT)" — which is how the abbreviations
 * below were verified rather than guessed.
 *
 * ── The distinction that matters most ───────────────────────────────────────
 * Not every AITA event is a junior event. "AITA Rs 1 Lakh" and "AITA Rs 2.5
 * Lakh" (38 editions, 14% of the tennis calendar) carry age groups of Men and
 * Women: they are the senior prize-money circuit. ITF Masters is Senior, WTA
 * 250 is the professional tour. Folding any of those into a junior ladder rung
 * would put an adult tournament into a twelve-year-old's plan, so `kind` exists
 * to keep them out, and it is deliberately not derived from `ageGroups` — a
 * missing age group should not silently promote a senior event into a junior
 * one.
 *
 * ── What is NOT asserted here ───────────────────────────────────────────────
 * The number in "CS7" and "TS7" is captured as `grade` because it is printed,
 * and for no other reason. This repo holds no AITA document saying what that
 * number means — whether it orders events by strength, by draw size, or by
 * points on offer. Nothing downstream may assume it ranks anything until that
 * is sourced. It is recorded so the question can be answered later without
 * re-parsing 898 rows.
 */

/** AITA's junior ladder, in the order the client's `JUNIOR_LADDER` lists it. */
export type AitaLadderRung =
  "Talent Series" | "Championship Series" | "Super Series" | "National Series" | "Nationals";

/** Who runs the event. ATF is the Asian Tennis Federation. */
export type EditionCircuit = "AITA" | "ITF" | "ATF" | "WTA";

/**
 * What sort of event this is, for deciding whether it belongs in a junior plan.
 * `unknown` is a real answer and is left visible rather than defaulted.
 */
export type EditionKind =
  | "junior-ladder"
  | "international-junior"
  | "senior-prize-money"
  | "masters"
  | "pro-tour"
  | "unknown";

export interface EditionSeries {
  ladder: AitaLadderRung | null;
  /** The printed number in CS7/TS7. Meaning unverified — see the note above. */
  grade: number | null;
  circuit: EditionCircuit | null;
  kind: EditionKind;
}

const UNKNOWN: EditionSeries = { ladder: null, grade: null, circuit: null, kind: "unknown" };

/** Drop the trailing "(City)" so a city name can never be read as a series. */
const stem = (name: string): string =>
  (name || "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Ordered on purpose: the first match wins.
 *
 * "Nationals" has to be tested before "NS", and both before the bare "National"
 * of "National Tennis Championship", or a National Series event is reported as
 * the National Championships — two very different tournaments, one of which a
 * player qualifies for.
 */
const RULES: Array<{
  test: RegExp;
  result: (match: RegExpMatchArray) => EditionSeries;
}> = [
  // ── Non-junior, matched first so nothing below can claim them ─────────────
  {
    // "AITA Rs 1 Lakh", "AITA Rs 2.5 Lakh" — the senior prize-money circuit.
    test: /\bRs\.?\s*[\d.]+\s*Lakh/i,
    result: () => ({ ladder: null, grade: null, circuit: "AITA", kind: "senior-prize-money" }),
  },
  {
    test: /\bITF\s+Masters\b/i,
    result: () => ({ ladder: null, grade: null, circuit: "ITF", kind: "masters" }),
  },
  {
    test: /\b(WTA|ATP)\b/i,
    result: () => ({ ladder: null, grade: null, circuit: "WTA", kind: "pro-tour" }),
  },

  // ── International junior ──────────────────────────────────────────────────
  {
    test: /\bITF\s+Juniors?\b/i,
    result: () => ({ ladder: null, grade: null, circuit: "ITF", kind: "international-junior" }),
  },
  {
    // "Asian", "AITA Asian", "Asian U/12", "Asian Grade A" — ATF junior events.
    // The letter grade is deliberately not captured as `grade`: it is a
    // different scale from the AITA number and conflating them would make the
    // field mean two things.
    test: /\bAsian\b/i,
    result: () => ({ ladder: null, grade: null, circuit: "ATF", kind: "international-junior" }),
  },

  // ── The AITA junior ladder ────────────────────────────────────────────────
  {
    test: /\b(?:Nationals|National\s+Tennis\s+Championship)\b/i,
    result: () => ({ ladder: "Nationals", grade: null, circuit: "AITA", kind: "junior-ladder" }),
  },
  {
    test: /\bTS[\s-]?(\d+)?\b/i,
    result: (m) => ({
      ladder: "Talent Series",
      grade: m[1] ? Number(m[1]) : null,
      circuit: "AITA",
      kind: "junior-ladder",
    }),
  },
  {
    test: /\bCS[\s-]?(\d+)?\b/i,
    result: (m) => ({
      ladder: "Championship Series",
      grade: m[1] ? Number(m[1]) : null,
      circuit: "AITA",
      kind: "junior-ladder",
    }),
  },
  {
    test: /\bSS[\s-]?(\d+)?\b/i,
    result: (m) => ({
      ladder: "Super Series",
      grade: m[1] ? Number(m[1]) : null,
      circuit: "AITA",
      kind: "junior-ladder",
    }),
  },
  {
    test: /\bNS[\s-]?(\d+)?\b/i,
    result: (m) => ({
      ladder: "National Series",
      grade: m[1] ? Number(m[1]) : null,
      circuit: "AITA",
      kind: "junior-ladder",
    }),
  },

  // ── Spelled out, as `officialName` prints them ────────────────────────────
  {
    test: /\bTalent\s+Series\b/i,
    result: () => ({
      ladder: "Talent Series",
      grade: null,
      circuit: "AITA",
      kind: "junior-ladder",
    }),
  },
  {
    test: /\bChampionship\s+Series\b/i,
    result: () => ({
      ladder: "Championship Series",
      grade: null,
      circuit: "AITA",
      kind: "junior-ladder",
    }),
  },
  {
    test: /\bSuper\s+Series\b/i,
    result: () => ({ ladder: "Super Series", grade: null, circuit: "AITA", kind: "junior-ladder" }),
  },
  {
    test: /\bNational\s+Series\b/i,
    result: () => ({
      ladder: "National Series",
      grade: null,
      circuit: "AITA",
      kind: "junior-ladder",
    }),
  },
];

/**
 * Read the series out of an edition's name.
 *
 * `officialName` is worth passing when it exists: it spells the series out in
 * full, so it resolves the cases the abbreviation cannot. It is tried second
 * rather than first because the short name is the one that is always present
 * and always carries the grade number.
 */
export function seriesFromEditionName(name: string, officialName?: string | null): EditionSeries {
  for (const candidate of [stem(name), stem(officialName ?? "")]) {
    if (!candidate) continue;
    for (const rule of RULES) {
      const match = candidate.match(rule.test);
      if (match) return rule.result(match);
    }
  }
  return { ...UNKNOWN };
}

/** "Championship Series grade 7", or the plainest true thing available. */
export function seriesLabel(series: EditionSeries): string | null {
  if (series.ladder) {
    return series.grade === null ? series.ladder : `${series.ladder} grade ${series.grade}`;
  }
  switch (series.kind) {
    case "international-junior":
      return series.circuit === "ITF" ? "ITF junior event" : "Asian junior event";
    case "senior-prize-money":
      return "AITA prize-money event";
    case "masters":
      return "ITF Masters event";
    case "pro-tour":
      return "Professional tour event";
    default:
      return null;
  }
}
