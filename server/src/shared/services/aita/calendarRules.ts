import type { AitaLadderRung } from "./editionSeries";
import type { DateString } from "./calendarParser";

/**
 * What AITA's 2026 junior rules say about fees and deadlines, as data.
 *
 * Source: "AITA Junior Tournament Structure", effective 1 January 2026
 * (https://www.aita.hitcourt.com/documents/Rules_Collated_AITA_Junior_Circuit_Tournaments_2026.pdf),
 * the same document `aitaRules.ts` in `shared-types` cites for the entry rules.
 *
 * ── Why this exists next to the fact sheets ─────────────────────────────────
 * The fact sheet for each event states its own fees and deadlines, and that page is
 * the authority. These rules are the cross-check and the fallback: on 2026-10-06 all
 * 12 junior-ladder fact sheets sampled agreed with them exactly, so an event whose
 * page disagrees, or cannot be read, is worth noticing and not silently trusting.
 *
 * Dated and sourced on purpose. AITA re-issues these rules (the 2026 document
 * changed two of the entry rules the client had wrong), so a value here needs a
 * year on it and a periodic re-read, and a mismatch with the pages is the prompt.
 */

export const RULES_YEAR = 2026;

export interface EntryFee {
  singles: number;
  /** Per pair. Null where the rules print "NA". */
  doubles: number | null;
}

/**
 * Entry fees in rupees, by level and length. The rules list Championship Series
 * separately for 3 and 7 days; the other levels have one fee.
 */
const FEES: Array<{ ladder: AitaLadderRung; days: number | null; fee: EntryFee }> = [
  { ladder: "Talent Series", days: null, fee: { singles: 400, doubles: 400 } },
  { ladder: "Championship Series", days: 3, fee: { singles: 400, doubles: null } },
  { ladder: "Championship Series", days: 7, fee: { singles: 600, doubles: 700 } },
  { ladder: "Super Series", days: null, fee: { singles: 700, doubles: 900 } },
  { ladder: "National Series", days: null, fee: { singles: 900, doubles: 1100 } },
  { ladder: "Nationals", days: null, fee: { singles: 1100, doubles: 1300 } },
];

/**
 * The fee the rules set for a level, or null when they do not say. A Championship
 * Series event of a length the rules do not list returns null and not the nearest
 * fee: a wrong figure on a parent's budget is worse than a blank.
 */
export function entryFeeFor(ladder: AitaLadderRung | null, days: number | null): EntryFee | null {
  if (!ladder) return null;
  const exact = FEES.find((row) => row.ladder === ladder && row.days === days);
  if (exact) return exact.fee;
  // A level with a single fee does not depend on length.
  const single = FEES.filter((row) => row.ladder === ladder && row.days === null);
  return single.length === 1 ? single[0]!.fee : null;
}

// ─── Deadlines ────────────────────────────────────────────────────────────────

export interface DeadlineDates {
  entryCloses: DateString;
  withdrawal: DateString;
  freeze: DateString;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONDAY = 1;
const THURSDAY = 4;

const toIso = (ms: number): DateString => new Date(ms).toISOString().slice(0, 10);

/** The nth given weekday strictly before `start`: n = 1 is the nearest one. */
function weekdayBefore(start: DateString, weekday: number, n: number): DateString {
  let ms = new Date(`${start}T00:00:00.000Z`).getTime();
  let found = 0;
  while (found < n) {
    ms -= DAY_MS;
    if (new Date(ms).getUTCDay() === weekday) found += 1;
  }
  return toIso(ms);
}

/**
 * The dates the 2026 rules fix from an event's start date:
 *
 *   entries close   "3 Mondays prior to commencement of the tournament"
 *   withdrawal      "Monday before the start of the tournament"
 *   freeze          the Thursday before the start
 *
 * Stated by the rules for Talent Series, Championship Series (7 days), Super
 * Series, National Series and Nationals. It is NOT claimed for anything else:
 * the 3-day Championship Series and the 10 & Under events print different
 * deadlines on their pages (a 10 & Under event sampled closed entries 5 days
 * out), so they return null and must be read from the fact sheet.
 */
export function deadlinesFor(
  startDate: DateString,
  ladder: AitaLadderRung | null,
  days: number | null
): DeadlineDates | null {
  if (!ladder) return null;
  if (ladder === "Championship Series" && days !== 7) return null;
  return {
    entryCloses: weekdayBefore(startDate, MONDAY, 3),
    withdrawal: weekdayBefore(startDate, MONDAY, 1),
    freeze: weekdayBefore(startDate, THURSDAY, 1),
  };
}

// ─── The rules a parent can be caught by ──────────────────────────────────────

/**
 * Consequences of withdrawing or not turning up. Defined once in `shared-types`,
 * because the website shows the same facts beside an event a parent has entered,
 * and two copies of a fine is how the two come to disagree.
 */
export { AITA_WITHDRAWAL_RULES as WITHDRAWAL_RULES } from "@powermysport/shared-types";
