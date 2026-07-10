export interface SupportedSport {
  slug: string;
  name: string;
}

export const SUPPORTED_SPORTS: SupportedSport[] = [
  { slug: "cricket", name: "Cricket" },
  { slug: "tennis", name: "Tennis" },
  { slug: "chess", name: "Chess" },
  { slug: "football", name: "Football" },
  { slug: "basketball", name: "Basketball" },
  { slug: "hockey", name: "Hockey" },
  { slug: "table-tennis", name: "Table Tennis" },
  { slug: "swimming", name: "Swimming" },
  { slug: "badminton", name: "Badminton" },
  { slug: "volleyball", name: "Volleyball" },
];

export const SUPPORTED_SPORT_SLUGS = new Set(
  SUPPORTED_SPORTS.map((s) => s.slug),
);

export const SUPPORTED_SPORT_NAMES = new Set(
  SUPPORTED_SPORTS.map((s) => s.name.toLowerCase()),
);

/** Normalise any user-supplied sport string to a slug for lookup. */
export function toSupportedSlug(sportName: string): string {
  return sportName.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Returns true if the given sport name/slug maps to a supported sport. */
export function isSupportedSport(sportName: string): boolean {
  const slug = toSupportedSlug(sportName);
  return (
    SUPPORTED_SPORT_SLUGS.has(slug) ||
    SUPPORTED_SPORT_NAMES.has(sportName.trim().toLowerCase())
  );
}
