// ─── Indian states & union territories ──────────────────────────────────────
//
// One list, matching `server/src/shared/utils/states.ts` and
// `server/src/constants/indianStates.ts` name for name.
//
// This matters because those server lists reject anything they don't recognise —
// `GET /pathways` answers 400 for an unknown state — so a UI list that drifts by
// one character silently turns a dropdown option into a failed request, and on a
// page that 404s when its fetch fails, into a 404 for the whole page.
//
// Three copies had already drifted that way: the guidance and roadmap constants
// both spelled the UT "Jammu & Kashmir" (the API wants "Jammu and Kashmir"), the
// roadmap's also abbreviated three more, and between them they omitted Andaman and
// Nicobar Islands, Dadra and Nagar Haveli and Daman and Diu, Ladakh and
// Lakshadweep. Those copies are gone — anything that sends a state to the server
// imports from here, and `normalizeStoredState` reads the old spellings back.

export const INDIAN_STATES_AND_UTS = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianStateOrUT = (typeof INDIAN_STATES_AND_UTS)[number];

/**
 * The name the API will accept, or `undefined` if there isn't one.
 *
 * Tolerant on input because stored profile values and hand-typed entries drift
 * in spelling — "jammu & kashmir" should still resolve. Output is always the
 * canonical spelling the API accepts.
 */
export function normalizeStateName(raw: string): IndianStateOrUT | undefined {
  const wanted = raw
    .trim()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  return INDIAN_STATES_AND_UTS.find((s) => s.toLowerCase() === wanted);
}

export function isIndianStateOrUT(raw: string): boolean {
  return normalizeStateName(raw) !== undefined;
}

/**
 * A stored state value, canonicalised for display and for the next save.
 *
 * Profile rows written while the dropdowns disagreed with the server hold names
 * like "Jammu & Kashmir". Read straight into a canonical `<select>` those match no
 * option, so the field renders blank and the value is lost the next time the user
 * saves the form. Anything genuinely unrecognisable is returned unchanged rather
 * than discarded — see `stateSelectOptions`.
 */
export function normalizeStoredState(raw?: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "";
  return normalizeStateName(trimmed) ?? trimmed;
}

/**
 * Options for a state `<select>`, with an unrecognised stored value kept
 * selectable so an editing user can't silently drop it by saving another field.
 */
export function stateSelectOptions(
  current?: string | null
): Array<{ value: string; label: string }> {
  const options = INDIAN_STATES_AND_UTS.map((s) => ({ value: s, label: s }));
  const kept = current?.trim();
  return kept && !normalizeStateName(kept) ? [{ value: kept, label: kept }, ...options] : options;
}
