import { Venue } from "@/types";

type VenueImageSource = Pick<Venue, "images" | "coverPhotoUrl"> & {
  generalImages?: string[];
  sportImages?: Record<string, string[]>;
};

type ImageSourceType = "structured" | "legacy" | "cover-only" | "none";

const getRecordValues = (value?: Record<string, string[]> | Map<string, string[]>): string[][] => {
  if (!value) return [];

  if (value instanceof Map) {
    return Array.from(value.values());
  }

  return Object.values(value);
};

const extractObjectKey = (value?: string): string => {
  if (!value) return "";

  const next = value.trim();
  if (!next) return "";

  try {
    const parsed = new URL(next);
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return key || next;
  } catch {
    return next;
  }
};

const pushUnique = (images: string[], seenKeys: Set<string>, value?: string) => {
  if (!value) return;

  const next = value.trim();
  if (!next) return;

  const key = extractObjectKey(next);
  if (!key || seenKeys.has(key)) return;

  seenKeys.add(key);

  images.push(next);
};

const getStructuredImages = (venue: VenueImageSource): string[] => {
  const flattenedGeneral = Array.isArray(venue.generalImages) ? venue.generalImages : [];

  const flattenedSports = getRecordValues(venue.sportImages).flatMap((sportImages) =>
    Array.isArray(sportImages) ? sportImages : []
  );

  return [...flattenedGeneral, ...flattenedSports];
};

export const getVenueImageAudit = (
  venue: VenueImageSource
): { source: ImageSourceType; images: string[] } => {
  const images: string[] = [];
  const seenKeys = new Set<string>();

  const structuredImages = getStructuredImages(venue);
  const hasStructured = structuredImages.length > 0;
  const hasLegacy = Array.isArray(venue.images) && venue.images.length > 0;

  if (hasStructured) {
    pushUnique(images, seenKeys, venue.coverPhotoUrl);
    structuredImages.forEach((url) => pushUnique(images, seenKeys, url));
    return { source: "structured", images };
  }

  if (hasLegacy) {
    pushUnique(images, seenKeys, venue.coverPhotoUrl);
    venue.images.forEach((url) => pushUnique(images, seenKeys, url));
    return { source: "legacy", images };
  }

  if (venue.coverPhotoUrl) {
    pushUnique(images, seenKeys, venue.coverPhotoUrl);
    return { source: "cover-only", images };
  }

  return { source: "none", images };
};

export const getVenueImageUrls = (venue: VenueImageSource): string[] => {
  return getVenueImageAudit(venue).images;
};

export const getVenueSportImageUrls = (venue: VenueImageSource, sport?: string): string[] => {
  if (!sport) return [];

  const sportImages =
    venue.sportImages instanceof Map ? venue.sportImages.get(sport) : venue.sportImages?.[sport];
  if (!Array.isArray(sportImages) || sportImages.length === 0) {
    return [];
  }

  const images: string[] = [];
  const seenKeys = new Set<string>();

  sportImages.forEach((url) => pushUnique(images, seenKeys, url));
  return images;
};
