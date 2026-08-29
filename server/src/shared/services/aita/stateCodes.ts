import { INDIAN_STATES_AND_UTS, IndianStateOrUT } from "../../utils/states";

/**
 * AITA identifies a player's state by a two-letter code — `MH`, `TG`, `KA`. The
 * old PDFs printed it bracketed as `(MH)`; the new platform carries it in the
 * row's state-filter link. Everything downstream of this file speaks the canonical names in
 * `shared/utils/states.ts`, because those are the only 36 strings the rest of
 * the API accepts: `GET /pathways` answers 400 for anything else, and a page
 * that 404s when its fetch fails turns that into a 404 for the whole page. So a
 * code we get wrong here does not degrade gracefully — it breaks a page.
 *
 * That is also why `resolveStateCode` returns null rather than guessing. An
 * unknown code quarantines its snapshot (see AitaRankingIngestService) instead
 * of silently landing a player under the wrong state.
 *
 * 29 distinct codes were observed in a single Boys U-14 list; the rest are here
 * so a first appearance from a small UT is not treated as corruption. Aliases
 * cover the spellings AITA has used inconsistently across years.
 */
const STATE_BY_CODE: Record<string, IndianStateOrUT> = {
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CG: "Chhattisgarh",
  CH: "Chandigarh",
  DL: "Delhi",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  GA: "Goa",
  GJ: "Gujarat",
  HP: "Himachal Pradesh",
  HR: "Haryana",
  JH: "Jharkhand",
  JK: "Jammu and Kashmir",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MH: "Maharashtra",
  ML: "Meghalaya",
  MN: "Manipur",
  MP: "Madhya Pradesh",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  PB: "Punjab",
  PY: "Puducherry",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TR: "Tripura",
  TS: "Telangana",
  UK: "Uttarakhand",
  UP: "Uttar Pradesh",
  WB: "West Bengal",

  // ── Aliases seen in older lists, before the 2019 renames settled ──────────
  OR: "Odisha", // pre-2011 "Orissa"
  UA: "Uttarakhand", // "Uttaranchal"
  UT: "Uttarakhand",
  CT: "Chhattisgarh",
  DD: "Dadra and Nagar Haveli and Daman and Diu", // pre-2020 "Daman and Diu"
  DH: "Dadra and Nagar Haveli and Daman and Diu",
  PO: "Puducherry", // "Pondicherry"
  PN: "Punjab",
  TG: "Telangana",
  AD: "Andaman and Nicobar Islands",
};

/** Canonical name for an AITA state code, or null if the code is unrecognised. */
export function resolveStateCode(code: string): IndianStateOrUT | null {
  const key = code.trim().toUpperCase();
  return STATE_BY_CODE[key] ?? null;
}

/**
 * AITA's four zones, by state code. 1 = North, 2 = South, 3 = East, 4 = West.
 *
 * Read off `/ranking-state` on the new platform (2026-08-29), which publishes a
 * `region_id` alongside each state — the first time this has been machine-
 * readable. It is not decoration: Talent Series entry is restricted to players
 * registered in the host zone, and changing zone needs written AITA approval
 * plus a six-month lock. The pathway product has been describing that boundary
 * from a 2020 PDF.
 *
 * Only the 36 codes AITA itself publishes are listed. The historical aliases
 * above deliberately have no zone: a row filed under "Orissa" tells us which
 * state it means but not which zone AITA would place it in today.
 */
export const AITA_ZONES = { NORTH: 1, SOUTH: 2, EAST: 3, WEST: 4 } as const;

const ZONE_BY_CODE: Record<string, number> = {
  // North
  CH: 1, DL: 1, HR: 1, HP: 1, JK: 1, LA: 1, PB: 1, UP: 1, UK: 1,
  // South
  AN: 2, AP: 2, KA: 2, KL: 2, LD: 2, PY: 2, TN: 2, TG: 2,
  // East
  AR: 3, AS: 3, BR: 3, JH: 3, MN: 3, ML: 3, MZ: 3, NL: 3, OD: 3, SK: 3, TR: 3, WB: 3,
  // West
  CG: 4, DH: 4, GA: 4, GJ: 4, MP: 4, MH: 4, RJ: 4,
};

/** AITA zone id for a state code, or null when the code is an alias or unknown. */
export function resolveZoneId(code: string): number | null {
  return ZONE_BY_CODE[code.trim().toUpperCase()] ?? null;
}

/**
 * Compares AITA's own published state table against the map above.
 *
 * Called at ingest so drift surfaces as a warning on the snapshot rather than as
 * a 400 from `GET /pathways` weeks later. Two directions matter and they are not
 * symmetrical: a code AITA publishes that we cannot resolve will strand players,
 * while a name mismatch means our canonical string and theirs have diverged —
 * which is the exact shape of the bug that turned a valid state pick into a
 * whole-page 404.
 */
export function reconcileStates(
  published: ReadonlyArray<{ code: string; name: string }>,
): string[] {
  const problems: string[] = [];
  for (const { code, name } of published) {
    const resolved = resolveStateCode(code);
    if (!resolved) {
      problems.push(`AITA publishes state code "${code}" (${name}) which we cannot map`);
      continue;
    }
    if (resolved !== name) {
      problems.push(
        `State "${code}": AITA calls it "${name}", we call it "${resolved}"`,
      );
    }
    if (resolveZoneId(code) === null) {
      problems.push(`State "${code}" (${name}) has no zone assigned`);
    }
  }
  return problems;
}

/**
 * Pulls the bracketed code out of a raw STATE cell. The cell is normally just
 * `(MH)`, but stray whitespace and the occasional missing bracket both show up.
 */
export function parseStateCell(cell: string): string | null {
  const bracketed = cell.match(/\(\s*([A-Za-z]{2})\s*\)/);
  if (bracketed?.[1]) return bracketed[1].toUpperCase();
  const bare = cell.trim().match(/^([A-Za-z]{2})$/);
  return bare?.[1] ? bare[1].toUpperCase() : null;
}

/** Every canonical name, for filter dropdowns. Re-exported so callers need one import. */
export const CANONICAL_STATES = INDIAN_STATES_AND_UTS;
