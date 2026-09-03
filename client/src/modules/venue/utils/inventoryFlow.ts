import type { OpeningHours } from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { Venue } from "@/types";

/**
 * Pure helpers and constants for the venue-lister inventory page —
 * extracted from `app/(booking)/(venue-lister)/venue-lister/inventory/page.tsx`,
 * which had grown to 1,802 lines. Nothing here changed behavior, only
 * location — including consolidating the three byte-identical inline
 * "default opening hours" object literals (form init, resetForm, handleEdit)
 * into one constant.
 */

export const AMENITIES_OPTIONS = [
  "Parking",
  "Restroom",
  "Water",
  "Changing Room",
  "Lockers",
  "Cafeteria",
  "AC",
  "Lights",
  "Equipment Rental",
  "WiFi",
];

const S3_BUCKET_HOST = "https://powermysport-images.s3.ap-south-1.amazonaws.com";

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
};

export const normalizePhone = (value: unknown) => {
  if (value == null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
};

export const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

// Kept identical to the GST_REGEX enforced server-side (ExpertsService.ts /
// Venue model) so a value valid here stays valid there.
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const formatSportLabel = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export const toS3Url = (key: string) => {
  const normalized = key.replace(/^\/+/, "");
  const encoded = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${S3_BUCKET_HOST}/${encoded}`;
};

export const normalizeImageIdentity = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const rawPath = url.pathname.replace(/^\/+/, "");
    const decodedPath = decodeURIComponent(rawPath);
    if (url.hostname.includes("powermysport-images")) {
      return decodedPath;
    }
    return `${url.hostname}/${decodedPath}`;
  } catch {
    return decodeURIComponent(trimmed.replace(/^\/+/, ""));
  }
};

export const dedupeUrls = (urls: string[]) => {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const identity = normalizeImageIdentity(url);
    if (!identity || seen.has(identity)) {
      return false;
    }
    seen.add(identity);
    return true;
  });
};

export const getVenueImageGroups = (venue: Venue) => {
  const directImages = venue.images || [];
  const directKeys = venue.imageKeys ? venue.imageKeys.map(toS3Url) : [];

  const generalImages = venue.generalImages || [];
  const generalKeys = venue.generalImageKeys ? venue.generalImageKeys.map(toS3Url) : [];
  const baseGeneral = [...generalImages, ...generalKeys];

  const sportsEntries = new Map<string, string[]>();
  if (venue.sportImages) {
    Object.entries(venue.sportImages).forEach(([sport, urls]) => {
      if (!sportsEntries.has(sport)) {
        sportsEntries.set(sport, []);
      }
      sportsEntries.set(sport, [...(sportsEntries.get(sport) || []), ...(urls || [])]);
    });
  }

  if (venue.sportImageKeys) {
    Object.entries(venue.sportImageKeys).forEach(([sport, keys]) => {
      if (!sportsEntries.has(sport)) {
        sportsEntries.set(sport, []);
      }
      sportsEntries.set(sport, [...(sportsEntries.get(sport) || []), ...(keys || []).map(toS3Url)]);
    });
  }

  const hasStructured = baseGeneral.length > 0 || sportsEntries.size > 0;
  const fallbackGeneral = hasStructured ? [] : [...directImages, ...directKeys];
  const general = dedupeUrls([...baseGeneral, ...fallbackGeneral]);
  const generalIdentities = new Set(general.map((url) => normalizeImageIdentity(url)));

  const sports = Object.fromEntries(
    Array.from(sportsEntries.entries()).map(([sport, urls]) => {
      const filtered = urls.filter((url) => {
        const identity = normalizeImageIdentity(url);
        return identity && !generalIdentities.has(identity);
      });
      return [sport, dedupeUrls(filtered)];
    })
  );

  const all = dedupeUrls([
    ...general,
    ...Object.values(sports).flat(),
    ...directImages,
    ...directKeys,
  ]);

  return { general, sports, all };
};

export const getCoverPhoto = (venue: Venue): string | null => {
  if (venue.coverPhotoUrl) return venue.coverPhotoUrl;
  if (venue.coverPhotoKey) return toS3Url(venue.coverPhotoKey);
  const groups = getVenueImageGroups(venue);
  return groups.all[0] ?? null;
};

export const getInputClassName = (hasError: boolean) =>
  `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition text-slate-900 placeholder-slate-500 ${
    hasError ? "border-red-500 bg-red-50" : "border-slate-300 bg-white"
  }`;
