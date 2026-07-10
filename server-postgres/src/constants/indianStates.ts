/**
 * Canonical list of Indian states and union territories.
 *
 * This is the single source of truth the server uses to keep address `state`
 * values consistent (Tier 0 of the address-consistency strategy). The client
 * ships a matching list to drive its dropdown; the server normalizes every
 * write against this list so data stays uniform regardless of the entry point
 * (web, mobile, imports, API clients).
 *
 * We store the canonical NAME (not the code) because existing data and the
 * invoice/email renderers already use names — storing codes would force a
 * display mapping everywhere plus a data migration.
 */
export interface IndianState {
  code: string;
  name: string;
}

export const INDIAN_STATES: IndianState[] = [
  // States
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OD", name: "Odisha" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TG", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
  // Union Territories
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "CH", name: "Chandigarh" },
  { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "DL", name: "Delhi" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "PY", name: "Puducherry" },
];

export const INDIAN_STATE_NAMES: string[] = INDIAN_STATES.map((s) => s.name);

/**
 * Known aliases / common misspellings → canonical name. Keys are pre-normalized
 * (lowercased, "&" → "and", whitespace collapsed) to match `normalizeStateName`.
 */
const STATE_ALIASES: Record<string, string> = {
  orissa: "Odisha",
  pondicherry: "Puducherry",
  pondichery: "Puducherry",
  uttaranchal: "Uttarakhand",
  "uttaranchal pradesh": "Uttarakhand",
  "nct of delhi": "Delhi",
  "new delhi": "Delhi",
  "national capital territory of delhi": "Delhi",
  "jammu kashmir": "Jammu and Kashmir",
  "j and k": "Jammu and Kashmir",
  tamilnadu: "Tamil Nadu",
  "tamil nadu state": "Tamil Nadu",
  "telangana state": "Telangana",
  "andaman nicobar": "Andaman and Nicobar Islands",
  "andaman and nicobar": "Andaman and Nicobar Islands",
};

const byLowerName = new Map(
  INDIAN_STATES.map((s) => [s.name.toLowerCase(), s.name] as const),
);
const byLowerCode = new Map(
  INDIAN_STATES.map((s) => [s.code.toLowerCase(), s.name] as const),
);

const toTitleCase = (value: string): string =>
  value.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Map an arbitrary user-entered state string to its canonical name.
 * Falls back to a cleaned, title-cased version when no match is found so we
 * never drop data — we just make it as consistent as possible.
 */
export const normalizeStateName = (input?: string | null): string => {
  if (!input || typeof input !== "string") return "";

  const cleaned = input.trim().replace(/\s+/g, " ").replace(/&/g, "and");
  if (!cleaned) return "";

  const key = cleaned.toLowerCase();

  const exact = byLowerName.get(key);
  if (exact) return exact;

  if (STATE_ALIASES[key]) return STATE_ALIASES[key];

  const byCode = byLowerCode.get(key);
  if (byCode) return byCode;

  return toTitleCase(cleaned);
};

export const isCanonicalState = (input?: string | null): boolean =>
  !!input && byLowerName.has(input.trim().toLowerCase());
