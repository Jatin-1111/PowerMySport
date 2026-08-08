import { INDIAN_STATES_AND_UTS, IndianStateOrUT } from "../../utils/states";

/**
 * AITA prints a player's state as a bracketed two-letter code — `(MH)`, `(TS)`,
 * `(KA)`. Everything downstream of this file speaks the canonical names in
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
