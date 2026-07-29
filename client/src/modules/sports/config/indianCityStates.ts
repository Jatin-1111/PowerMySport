// ─── City → state lookup for federation calendar data ───────────────────────
//
// Extracted tournament editions carry a `city` but no state, while the player
// profile stores `location` (the state) and no city — so one of them has to be
// translated for "events near us" to work. Deriving state from city is the
// cheap direction: it needs no schema change and no re-extraction, and the
// client already holds every edition in memory for the calendar view.
//
// Filtering by state rather than city is also what the data supports. Exact-city
// matching is far too narrow in practice — Under-14 in Delhi is 3 events, and 23
// of the 41 cities in the AITA calendar host only a single event — whereas
// Under-14 in Haryana is 10.
//
// Covers every city currently present in federation calendar data. Unknown
// cities resolve to null and are treated as "state unknown" rather than being
// hidden, so a new city appearing in an extraction never silently disappears
// from results.

const CITY_TO_STATE: Record<string, string> = {
  ahmedabad: "Gujarat",
  ajmer: "Rajasthan",
  amritsar: "Punjab",
  bahadurgarh: "Haryana",
  bangalore: "Karnataka",
  belagavi: "Karnataka",
  // The AITA calendar spells this city both ways.
  belgavi: "Karnataka",
  bengaluru: "Karnataka",
  bhimavaram: "Andhra Pradesh",
  bhubaneswar: "Odisha",
  chandigarh: "Chandigarh",
  chennai: "Tamil Nadu",
  cuttack: "Odisha",
  delhi: "Delhi",
  gangtok: "Sikkim",
  goa: "Goa",
  gohana: "Haryana",
  gudur: "Andhra Pradesh",
  gurugram: "Haryana",
  guwahati: "Assam",
  gwalior: "Madhya Pradesh",
  hyderabad: "Telangana",
  indore: "Madhya Pradesh",
  jaipur: "Rajasthan",
  jalandhar: "Punjab",
  jassowal: "Punjab",
  jind: "Haryana",
  jorhat: "Assam",
  karnal: "Haryana",
  khammam: "Telangana",
  kolkata: "West Bengal",
  lucknow: "Uttar Pradesh",
  mandya: "Karnataka",
  mumbai: "Maharashtra",
  "new delhi": "Delhi",
  numaligarh: "Assam",
  panchkula: "Haryana",
  patna: "Bihar",
  pollachi: "Tamil Nadu",
  prayagraj: "Uttar Pradesh",
  pune: "Maharashtra",
  raipur: "Chhattisgarh",
  rajsamand: "Rajasthan",
  siliguri: "West Bengal",
  sonipat: "Haryana",
  // Three spellings of Thiruvananthapuram appear across extractions.
  thiruvananthapuram: "Kerala",
  thiruvananthapuran: "Kerala",
  thiruvanathapuram: "Kerala",
  trichy: "Tamil Nadu",
  tiruchirappalli: "Tamil Nadu",
  udaipur: "Rajasthan",
  vadodara: "Gujarat",
  visakhapatnam: "Andhra Pradesh",
  zirakpur: "Punjab",
};

/**
 * Resolves an edition's city to an Indian state, or null when unrecognised.
 * Tolerates a trailing parenthetical, since venue-ish values like
 * "Bangalore (PSB)" sometimes land in the city field.
 */
export function stateForCity(city: string | undefined | null): string | null {
  if (!city) return null;
  const key = city
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim();
  return CITY_TO_STATE[key] ?? null;
}
