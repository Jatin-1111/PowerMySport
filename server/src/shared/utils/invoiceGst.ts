import { INDIAN_STATES, normalizeStateName } from "../../constants/indianStates";

/**
 * Official GST state codes (the numeric prefix of a 15-char GSTIN), keyed by
 * the canonical state name from `indianStates.ts`. Public, standardized data —
 * https://www.gst.gov.in state code list.
 */
const GST_STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  Punjab: "03",
  Chandigarh: "04",
  Uttarakhand: "05",
  Haryana: "06",
  Delhi: "07",
  Rajasthan: "08",
  "Uttar Pradesh": "09",
  Bihar: "10",
  Sikkim: "11",
  "Arunachal Pradesh": "12",
  Nagaland: "13",
  Manipur: "14",
  Mizoram: "15",
  Tripura: "16",
  Meghalaya: "17",
  Assam: "18",
  "West Bengal": "19",
  Jharkhand: "20",
  Odisha: "21",
  Chhattisgarh: "22",
  "Madhya Pradesh": "23",
  Gujarat: "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  Maharashtra: "27",
  Karnataka: "29",
  Goa: "30",
  Lakshadweep: "31",
  Kerala: "32",
  "Tamil Nadu": "33",
  Puducherry: "34",
  "Andaman and Nicobar Islands": "35",
  Telangana: "36",
  "Andhra Pradesh": "37",
  Ladakh: "38",
};

/** "Maharashtra" -> "Maharashtra (27)". Returns the bare name if no code is known. */
export const formatStateWithGstCode = (stateName: string): string => {
  const canonical = normalizeStateName(stateName);
  const code = GST_STATE_CODES[canonical];
  return code ? `${canonical} (${code})` : canonical;
};

const STATE_NAMES_BY_LENGTH_DESC = [...INDIAN_STATES]
  .map((s) => s.name)
  .sort((a, b) => b.length - a.length);

/**
 * Best-effort extraction of an Indian state name from a free-text address
 * string (venues/coaches store address as a single field, not structured).
 * Returns undefined rather than guessing wrong when no state name appears.
 */
export const guessStateFromAddress = (address?: string | null): string | undefined => {
  if (!address) return undefined;
  const haystack = address.toLowerCase();
  for (const name of STATE_NAMES_BY_LENGTH_DESC) {
    if (haystack.includes(name.toLowerCase())) return name;
  }
  return undefined;
};

/** Convenience: guess a state from an address and format it with its GST code. */
export const guessPlaceOfSupply = (address?: string | null): string => {
  const state = guessStateFromAddress(address);
  return state ? formatStateWithGstCode(state) : "-";
};
