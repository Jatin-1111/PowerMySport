const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "7 Sep 2026" from an ISO date, read in UTC like every date the lists carry. */
export function listDate(iso?: string | null): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "N/A";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Numbers with Indian grouping; one decimal only when the figure is fractional. */
export function formatPoints(value: number): string {
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const [whole, frac] = fixed.split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return frac ? `${grouped}.${frac}` : grouped;
}

/** AITA prints names in capitals. Leave mixed case alone; otherwise capitalise each part. */
export function displayName(name?: string | null): string {
  if (!name) return "";
  if (name !== name.toUpperCase()) return name;
  // Plain a-z on purpose: unicode property escapes are not guaranteed in the phone's JS engine.
  return name
    .toLowerCase()
    .replace(/(^|[\s'\-.])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** "Boys U-14" as "Boys Under-14", "Men Singles" as "Men's Singles". */
export function comboLabel(category: string, subcategory: string): string {
  if (/^U-\d+$/i.test(subcategory)) return `${category} Under-${subcategory.slice(2)}`;
  if (category === "Men" || category === "Women") return `${category}'s ${subcategory}`;
  return `${category} ${subcategory}`;
}

export const isJunior = (subcategory: string): boolean => /^U-\d+$/i.test(subcategory);

/** "ranked among the top 400 in India" or "in the top 25% in India". Null without a list size. */
export function standingPhrase(rank: number, listSize: number | null | undefined): string | null {
  if (!listSize) return null;
  const percent = Math.max(1, Math.ceil((rank / listSize) * 100));
  // Never "top 80%": past half, the honest statement is the size of the field.
  return percent > 50
    ? `ranked among the top ${listSize} in India`
    : `in the top ${percent}% in India`;
}

/** "top spot" or "top 100". */
export const tierPhrase = (rank: number): string => (rank === 1 ? "top spot" : `top ${rank}`);

export function weeksPhrase(weeks: number): string {
  if (weeks <= 1) return "about a week";
  if (weeks < 9) return `about ${Math.round(weeks)} weeks`;
  const months = Math.round(weeks / 4.345);
  return months <= 1 ? "about a month" : `about ${months} months`;
}

/** The movement chip text, or null when there is no previous list to compare with. */
export function movementText(
  delta: number | null | undefined,
  hasBaseline: boolean
): string | null {
  if (!hasBaseline) return null;
  if (delta === null || delta === undefined) return "New";
  if (delta === 0) return "Unchanged";
  return `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)}`;
}

/** The smallest U-n bracket among a player's current lists is their own age group. */
export function ownBracket(subcategories: string[]): string | null {
  const ages = subcategories
    .filter(isJunior)
    .map((s) => ({ s, age: Number(s.slice(2)) }))
    .sort((a, b) => a.age - b.age);
  return ages[0]?.s ?? null;
}
