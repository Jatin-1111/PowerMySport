/**
 * Shared tournament/federation display constants.
 *
 * Single source of truth for the sport-label map and the calendar timezone,
 * used by both the federations detail pages (src/app) and, since neither can
 * import the other's app-side file across the src/app -> src/modules
 * boundary, the tournament sitemap/detail-page logic that also needs them.
 * The two `app/` files re-export these under their original names so every
 * existing importer keeps working unchanged.
 */

export const SPORT_LABEL: Record<string, string> = {
  cricket: "Cricket",
  tennis: "Tennis",
  chess: "Chess",
  football: "Football",
  basketball: "Basketball",
  hockey: "Hockey",
  "table-tennis": "Table Tennis",
  swimming: "Swimming",
  badminton: "Badminton",
  volleyball: "Volleyball",
};

// Editions are calendar dates stored as UTC midnight, so every read using this
// constant uses UTC getters / `timeZone: "UTC"` — otherwise a viewer west of
// UTC sees every tournament shifted a day earlier. Separately: ICU returns a
// broken string (e.g. "2026 (day: 31)") when "day"+"year" are requested
// without "month", so every option bag that asks for a day must also ask for
// a month.
export const CAL_TZ = "UTC";
