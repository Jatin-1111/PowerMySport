/**
 * Shared vocabulary for the AITA ranking pipeline. Lives apart from the models
 * so the source client and the parser can import it without pulling mongoose in.
 *
 * ── Two vocabularies on purpose ──────────────────────────────────────────────
 * AITA moved off WordPress onto the hitcourt.com platform in August 2026, and
 * its coordinate system changed with it: the old `category` + `subcategory` pair
 * ("Boys" + "U-14") became a single flat code ("BS14"), plus a numeric id (17)
 * that the AJAX endpoints and the PDF export want instead of the code.
 *
 * We keep storing the OLD pair. Not out of sentiment — 468k archived rows and
 * every public URL are keyed on it, and re-keying them buys nothing a lookup
 * table cannot. So `AITA_LISTS` is the translation layer, and it is the only
 * place the new vocabulary is allowed to leak in from.
 */

/**
 * Categories that appear in stored data. "Boys" through "Women" are the twelve
 * live lists; Seniors and Wheelchair were already stale since 2021 under the old
 * site and have no equivalent on the new one, so they are kept only so archived
 * snapshots still type-check.
 */
export const AITA_CATEGORIES = [
  "Boys",
  "Girls",
  "Men",
  "Women",
  "Seniors",
  "Seniorwomen",
  "Wheelchair",
] as const;
export type AitaCategory = (typeof AITA_CATEGORIES)[number];

/** The `category` query value on the new platform. */
export type AitaListCode =
  "BS12" | "BS14" | "BS16" | "BS18" | "GS12" | "GS14" | "GS16" | "GS18" | "MS" | "MD" | "WS" | "WD";

export interface AitaList {
  /** What `/ranking-view?category=` takes. */
  code: AitaListCode;
  /**
   * What the AJAX endpoints and `/ranking-pdf?category=` take instead.
   *
   * Not derivable from the code and not contiguous — singles occupy 16–25 and
   * doubles were bolted on later at 30 and 35. Measured, not guessed.
   */
  categoryId: number;
  /** Stored category. Unchanged across the cutover so archived rows stay joinable. */
  category: AitaCategory;
  /** Stored subcategory. Likewise. */
  subcategory: string;
  /** Human label, as AITA titles the page. */
  label: string;
}

/**
 * The twelve lists AITA publishes, and the only ones the scheduler touches.
 *
 * Verified live 2026-08-29: all twelve return rows for wid 1786300200.
 */
export const AITA_LISTS: readonly AitaList[] = [
  { code: "BS12", categoryId: 16, category: "Boys", subcategory: "U-12", label: "Boys 12 & Under" },
  { code: "BS14", categoryId: 17, category: "Boys", subcategory: "U-14", label: "Boys 14 & Under" },
  { code: "BS16", categoryId: 18, category: "Boys", subcategory: "U-16", label: "Boys 16 & Under" },
  { code: "BS18", categoryId: 19, category: "Boys", subcategory: "U-18", label: "Boys 18 & Under" },
  {
    code: "GS12",
    categoryId: 21,
    category: "Girls",
    subcategory: "U-12",
    label: "Girls 12 & Under",
  },
  {
    code: "GS14",
    categoryId: 22,
    category: "Girls",
    subcategory: "U-14",
    label: "Girls 14 & Under",
  },
  {
    code: "GS16",
    categoryId: 23,
    category: "Girls",
    subcategory: "U-16",
    label: "Girls 16 & Under",
  },
  {
    code: "GS18",
    categoryId: 24,
    category: "Girls",
    subcategory: "U-18",
    label: "Girls 18 & Under",
  },
  { code: "MS", categoryId: 20, category: "Men", subcategory: "Singles", label: "Men's Singles" },
  { code: "MD", categoryId: 30, category: "Men", subcategory: "Doubles", label: "Men's Doubles" },
  {
    code: "WS",
    categoryId: 25,
    category: "Women",
    subcategory: "Singles",
    label: "Women's Singles",
  },
  {
    code: "WD",
    categoryId: 35,
    category: "Women",
    subcategory: "Doubles",
    label: "Women's Doubles",
  },
];

/**
 * Kept for callers that still iterate combos in the stored vocabulary (the
 * backfill CLI, the rankings controller). Derived so the two can never drift.
 */
export const LIVE_COMBOS: ReadonlyArray<{
  category: AitaCategory;
  subcategory: string;
}> = AITA_LISTS.map(({ category, subcategory }) => ({ category, subcategory }));

/** Lookup by the new platform's code. */
export function listByCode(code: string): AitaList | null {
  return AITA_LISTS.find((l) => l.code === code.trim().toUpperCase()) ?? null;
}

/** Lookup by the stored (category, subcategory) pair. */
export function listForCombo(category: string, subcategory: string): AitaList | null {
  const c = category.trim().toLowerCase();
  const s = subcategory.trim().toLowerCase();
  return (
    AITA_LISTS.find((l) => l.category.toLowerCase() === c && l.subcategory.toLowerCase() === s) ??
    null
  );
}

/**
 * One publication week.
 *
 * `wid` is Unix epoch *seconds* for the as-on Monday at 00:00 IST — 1786300200
 * is Monday 10 Aug 2026. Because the identifier is the date, two old bug classes
 * disappear: the `DD-MM-YYYY`-display-vs-`YYYY-MM-DD`-value trap, and the need
 * to cross-check a printed "As on 02nd Feb , 2026" line against the date we
 * asked for.
 */
export interface AitaWeek {
  wid: number;
  /** `YYYY-MM-DD`, derived from `wid` in IST. */
  asOnDate: string;
  /** AITA's own label, e.g. "10 Aug 2026". Kept for provenance. */
  label: string;
}

/** A ranking list that exists at the source, before anything has been fetched. */
export interface DiscoveredSnapshot {
  category: AitaCategory;
  subcategory: string;
  /** The Monday the ranking is "as on", not the day it was uploaded. */
  asOnDate: string; // YYYY-MM-DD
  /** The week id this list was requested under. */
  wid: number;
  /** The `ranking-view` URL the rows were read from — public provenance. */
  sourceUrl: string;
}

/** A state as AITA itself publishes it, codes and zone included. */
export interface AitaState {
  code: string;
  name: string;
  /**
   * AITA's zone id. 1 = North, 2 = South, 3 = East, 4 = West.
   *
   * Worth capturing beyond curiosity: Talent Series entry is restricted to
   * players registered in the host zone, so this is the eligibility boundary the
   * pathway product has been describing from a 2020 PDF.
   */
  zoneId: number;
}

/**
 * Which way a player moved since the previous published week, as the source
 * renders it.
 *
 * Treated as a cross-check, never as the source of truth, because the source
 * conflates two states we care about keeping apart: a player who did not move
 * and a player with no previous week to compare against both render as a dash.
 * `prevRank` / `comparedTo` stay derived from our own archive.
 */
export interface SourceMovement {
  direction: "up" | "down" | "none";
  /** Places moved, always non-negative. Zero when direction is "none". */
  places: number;
}

/** One player's row, as the parser hands it over. */
export interface ParsedRankingRow {
  rank: number;
  /**
   * Empty on the list page — it prints one name field, with the family name in
   * caps but no reliable delimiter. Populated only where the source splits it
   * itself (tournament acceptance lists do). Always prefer `fullName`.
   */
  givenName: string;
  familyName: string;
  /** Always populated. */
  fullName: string;
  /**
   * The six-digit AITA registration number — the same identifier the old PDFs
   * printed as `REG NO.`, which is what keeps the primary key
   * (asOnDate, category, subcategory, regNo) continuous across the cutover.
   * Decoded out of `playerKey` rather than printed on its own.
   */
  regNo: string;
  /**
   * The source's own base64 player id, e.g. `UklBTkFONDQwMDkw`. Decodes to
   * `RIANAN440090` — a 3+3 letter name prefix plus the registration number.
   * Stored because it is the key for the profile and point-breakdown endpoints.
   */
  playerKey: string;
  /**
   * Always null now. The new platform publishes year of birth only, which
   * closed our DPDP exposure at the source; the field stays so archived rows
   * keep their shape and the `select: false` guard keeps protecting them.
   */
  dob: Date | null;
  /** The only age datum the source now gives us. */
  birthYear: number | null;
  stateCode: string | null;
  /**
   * Column label -> value. The list page prints only the total, so this holds a
   * single entry unless a breakdown was fetched separately and merged in.
   */
  points: Array<{ label: string; value: number }>;
  totalPoints: number;
  /** Tournaments counted toward this ranking. Rendered but empty at cutover. */
  tournamentsPlayed: number | null;
  /** World Tennis Number. Sparse — every row read `-` at cutover. */
  wtnSingles: number | null;
  wtnDoubles: number | null;
  /** Hosted on AITA's bucket. Not mirrored: these are photographs of children. */
  photoUrl: string | null;
  sourceMovement: SourceMovement | null;
}

/** Everything a parse run learned, including what it could not make sense of. */
export interface ParseResult {
  rows: ParsedRankingRow[];
  /** Column labels in order, for display and for the insights layer. */
  columns: string[];
  /**
   * The `weekof_int` the page echoed back in its own inline script.
   *
   * This replaces the old printed-"As on"-line cross-check, and is strictly
   * better than it was: the server tells us which week and which list it
   * actually served, so a request that silently fell back to a default is
   * caught rather than filed under the date we asked for.
   */
  sourceWeekof: number | null;
  /** The `category` code the page echoed back, e.g. "BS12". */
  sourceCategory: string | null;
  diagnostics: {
    malformedRows: number;
    /** Rows with no year of birth. Named for continuity with archived snapshots. */
    missingDob: number;
    unknownStateCodes: string[];
    /** How many rows carry one. A handful is AITA's own typo; a lot is a misparse. */
    unknownStateRows: number;
    /** Cards that looked like data but could not be read. */
    unparsedLines: string[];
    warnings: string[];
  };
}

/**
 * One player's point breakdown, from `/ranking-player-point-view`.
 *
 * The reason this type exists at all: the roll-down from the bracket above used
 * to be invisible on the source sheet and had to be recovered as a residual.
 * The new endpoint labels it outright — for a Boys U-12 player it appears as a
 * `14&Under` row, and `725.00 + 168.75 + 255.25 = 1149.00` reconciles exactly.
 */
export interface ParsedPointBreakdown {
  rank: number | null;
  slices: Array<{
    label: string;
    value: number;
    /**
     * True for the raw `Best 8 Dbls` column, which is not part of the score —
     * only its `25% Best 8 Dbls` sibling counts. Stacking both double-counts
     * doubles.
     */
    isInformational: boolean;
    /** True for `Penalty Pts`, which is a deduction rather than a component. */
    isDeduction: boolean;
    /** True for the `<N>&Under` roll-down of the bracket above. */
    isRollDown: boolean;
  }>;
  totalPoints: number | null;
}
