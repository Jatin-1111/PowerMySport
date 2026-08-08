/**
 * Shared vocabulary for the AITA ranking pipeline. Lives apart from the models
 * so the source client and the parser can import it without pulling mongoose in.
 */

/** The seven values AITA's own category dropdown posts. Spelling is theirs, not ours. */
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

/**
 * The twelve combinations AITA still publishes weekly. Seniors (35+ through
 * 65+) and Wheelchair are discoverable but have not been updated since 2021, so
 * the scheduler polls only these and a manual run is needed for the rest.
 */
export const LIVE_COMBOS: ReadonlyArray<{
  category: AitaCategory;
  subcategory: string;
}> = [
  { category: "Boys", subcategory: "U-12" },
  { category: "Boys", subcategory: "U-14" },
  { category: "Boys", subcategory: "U-16" },
  { category: "Boys", subcategory: "U-18" },
  { category: "Girls", subcategory: "U-12" },
  { category: "Girls", subcategory: "U-14" },
  { category: "Girls", subcategory: "U-16" },
  { category: "Girls", subcategory: "U-18" },
  { category: "Men", subcategory: "Singles" },
  { category: "Men", subcategory: "Doubles" },
  { category: "Women", subcategory: "Singles" },
  { category: "Women", subcategory: "Doubles" },
];

/**
 * The combo the hourly poll checks. Boys U-18 carried the longest unbroken
 * history of any list (252 snapshots against 250 for the thinnest), which makes
 * it the least likely to be the one AITA forgets to upload. It is a tripwire,
 * not a source of truth — the weekly sweep still checks all twelve, because the
 * snapshot counts differ across combos and they do not always land together.
 */
export const SENTINEL_COMBO = { category: "Boys", subcategory: "U-18" } as const;

/** A ranking list that exists at the source, before anything has been fetched. */
export interface DiscoveredSnapshot {
  category: AitaCategory;
  subcategory: string;
  /** The Monday the ranking is "as on", not the day it was uploaded. */
  asOnDate: string; // YYYY-MM-DD
  /** Absolute URL of the PDF, read off the result page — never constructed. */
  pdfUrl: string;
  /** The result page it was read from, kept as public provenance. */
  sourceUrl: string;
}

/** One player's row, as the parser hands it over. */
export interface ParsedRankingRow {
  rank: number;
  /**
   * Empty when the list uses a single `NAME OF PLAYER` column instead of the
   * split pair — the U-12 and U-16 lists do. Always prefer `fullName`.
   */
  givenName: string;
  familyName: string;
  /** Always populated, however the source chose to split the name. */
  fullName: string;
  regNo: string;
  /** Parsed from `DD-MMM-YY`. Internal only — never leaves the server. */
  dob: Date | null;
  stateCode: string | null;
  /** Column label -> value, straight off the PDF header. Varies by category. */
  points: Array<{ label: string; value: number }>;
  totalPoints: number;
}

/** Everything a parse run learned, including what it could not make sense of. */
export interface ParseResult {
  rows: ParsedRankingRow[];
  /** Header labels in column order, e.g. ["RANK", "Given Name", ...]. */
  columns: string[];
  pageCount: number;
  asOnLabel: string | null;
  diagnostics: {
    malformedRows: number;
    missingDob: number;
    unknownStateCodes: string[];
    /** How many rows carry one. A handful is AITA's own typo; a lot is a misparse. */
    unknownStateRows: number;
    /** Lines that looked like data but could not be assigned to columns. */
    unparsedLines: string[];
    warnings: string[];
  };
}
