import { normalizeStateName } from "@/lib/indianStates";
import type { OpeningHours } from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { getDefaultOpeningHours } from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import type { AcademyVenueInput } from "@/modules/onboarding/types/academy";

/**
 * The rules for the venues step of academy sign-up, kept apart from the form so
 * they can be tested. They mirror what the server's step 4 validator enforces, so
 * the form says what is wrong before the server has to refuse it.
 */

/** At least this many general photos of the venue. */
export const MIN_GENERAL_PHOTOS = 3;
/** At least this many photos for every sport the venue lists. */
export const MIN_SPORT_PHOTOS = 5;
/** Smallest price the server accepts is one rupee, stored as paise. */
export const MIN_PRICE_PAISE = 100;
export const MAX_DESCRIPTION_LENGTH = 500;

/** The photo types and size the upload links are signed for (the server signs image/jpeg). */
export const VENUE_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;
export const VENUE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

// ── Money ────────────────────────────────────────────────────────────────────

/**
 * What the owner types is rupees; the server stores paise. A slip here is a 100x
 * error, so this works on the digits of the text and never multiplies a float
 * (1.005 * 100 is 100.49999999999999, which would round the wrong way).
 * Rounds half up to the nearest paisa. Anything that is not a plain positive
 * number gives 0.
 */
export const rupeesToPaise = (rupees: number | string): number => {
  const text = String(rupees).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return 0;
  const [whole = "0", fraction = ""] = text.split(".");
  const digits = fraction.padEnd(3, "0");
  let paise = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) paise += 1;
  return paise;
};

export const paiseToRupees = (paise: number | null | undefined): number | "" => {
  if (!paise || !Number.isFinite(paise)) return "";
  return paise / 100;
};

// ── A new venue ──────────────────────────────────────────────────────────────

export const createEmptyVenue = (): AcademyVenueInput => ({
  name: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  placeId: "",
  // Placeholder only. A venue is not valid until its location is confirmed from
  // the map search, so these coordinates are never trusted.
  location: { type: "Point", coordinates: [0, 0] },
  sports: [],
  pricePerHour: 0,
  amenities: [],
  description: "",
  openingHours: getDefaultOpeningHours(),
  allowExternalCoaches: true,
  generalImages: [],
  generalImageKeys: [],
  sportImages: {},
  sportImageKeys: {},
  coverPhotoUrl: "",
  coverPhotoKey: "",
});

/** True when the coordinates are a real place, not the empty placeholder. */
export const hasRealLocation = (venue: Pick<AcademyVenueInput, "location">): boolean => {
  const [lng, lat] = venue.location?.coordinates ?? [0, 0];
  return Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0);
};

/**
 * Changing the sports changes which photo sets are needed: keep the photos of
 * sports that stay, drop the sets for sports that go, start empty for new ones.
 */
export const withSports = (venue: AcademyVenueInput, sports: string[]): AcademyVenueInput => ({
  ...venue,
  sports,
  sportImages: Object.fromEntries(sports.map((s) => [s, venue.sportImages[s] ?? []])),
  sportImageKeys: Object.fromEntries(sports.map((s) => [s, venue.sportImageKeys[s] ?? []])),
});

// ── Photos ───────────────────────────────────────────────────────────────────

export interface PhotoProgress {
  general: { have: number; need: number };
  sports: Record<string, { have: number; need: number }>;
  coverChosen: boolean;
  /** True when every required photo is in and a cover is chosen. */
  complete: boolean;
}

export const photoProgress = (venue: AcademyVenueInput): PhotoProgress => {
  const general = { have: venue.generalImages.length, need: MIN_GENERAL_PHOTOS };
  const sports = Object.fromEntries(
    venue.sports.map((sport) => [
      sport,
      { have: (venue.sportImages[sport] ?? []).length, need: MIN_SPORT_PHOTOS },
    ])
  );
  const coverChosen =
    Boolean(venue.coverPhotoUrl) && venue.generalImages.includes(venue.coverPhotoUrl);
  const complete =
    general.have >= general.need &&
    coverChosen &&
    Object.values(sports).every((s) => s.have >= s.need);
  return { general, sports, coverChosen, complete };
};

/** Why a file cannot be uploaded, or an empty string when it can. */
export const photoFileProblem = (file: { type: string; size: number }): string => {
  if (!(VENUE_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "Use a JPG or PNG photo";
  }
  if (file.size > VENUE_PHOTO_MAX_BYTES) {
    return `Each photo must be smaller than ${Math.round(VENUE_PHOTO_MAX_BYTES / (1024 * 1024))} MB`;
  }
  return "";
};

// ── Opening hours ────────────────────────────────────────────────────────────

const toMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

/** An error message for the hours, or an empty string when they are fine. */
export const openingHoursProblem = (hours: OpeningHours): string => {
  const open = DAY_KEYS.filter((day) => hours[day]?.isOpen);
  if (open.length === 0) return "Open on at least one day";

  for (const day of open) {
    const d = hours[day];
    const slots =
      d.slots && d.slots.length > 0
        ? d.slots
        : d.openTime && d.closeTime
          ? [{ startTime: d.openTime, endTime: d.closeTime }]
          : [];
    if (slots.length === 0) return `Add opening times for ${day}`;

    const sorted = [...slots].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    for (let i = 0; i < sorted.length; i += 1) {
      const slot = sorted[i]!;
      if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
        return `On ${day}, closing time must be after opening time`;
      }
      const previous = sorted[i - 1];
      if (previous && toMinutes(slot.startTime) < toMinutes(previous.endTime)) {
        return `On ${day}, opening times overlap`;
      }
    }
  }
  return "";
};

// ── The whole venue ──────────────────────────────────────────────────────────

export type VenueErrors = Partial<
  Record<
    | "name"
    | "address"
    | "location"
    | "city"
    | "state"
    | "pincode"
    | "sports"
    | "price"
    | "hours"
    | "description"
    | "generalPhotos"
    | "cover",
    string
  >
> & { sportPhotos?: Record<string, string> };

/** What is wrong with a venue, by field. Empty when it can be saved. */
export const validateVenue = (venue: AcademyVenueInput): VenueErrors => {
  const errors: VenueErrors = {};

  if (venue.name.trim().length < 2) errors.name = "Enter the venue name";
  if (venue.address.trim().length < 5) errors.address = "Search for the venue address";
  else if (!hasRealLocation(venue)) errors.location = "Pick the address from the search results";
  if (venue.city.trim().length < 2) errors.city = "Enter the city";
  if (!normalizeStateName(venue.state)) errors.state = "Choose the state";
  if (!/^\d{6}$/.test(venue.pincode)) errors.pincode = "Pincode must be 6 digits";
  if (venue.sports.length === 0) errors.sports = "Choose at least one sport";
  if (!venue.pricePerHour || venue.pricePerHour < MIN_PRICE_PAISE) {
    errors.price = "Price per hour must be at least ₹1";
  }

  const hours = openingHoursProblem(venue.openingHours);
  if (hours) errors.hours = hours;
  if ((venue.description ?? "").length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters`;
  }

  const progress = photoProgress(venue);
  if (progress.general.have < progress.general.need) {
    const missing = progress.general.need - progress.general.have;
    errors.generalPhotos = `Add ${missing} more general ${missing === 1 ? "photo" : "photos"}`;
  } else if (!progress.coverChosen) {
    errors.cover = "Choose a cover photo from the general photos";
  }

  const sportPhotos: Record<string, string> = {};
  for (const [sport, count] of Object.entries(progress.sports)) {
    if (count.have < count.need) {
      const missing = count.need - count.have;
      sportPhotos[sport] = `Add ${missing} more ${sport} ${missing === 1 ? "photo" : "photos"}`;
    }
  }
  if (Object.keys(sportPhotos).length > 0) errors.sportPhotos = sportPhotos;

  return errors;
};

export const venueIsValid = (venue: AcademyVenueInput): boolean =>
  Object.keys(validateVenue(venue)).length === 0;

/** The venues as the server wants them: canonical state, trimmed text, no placeholder fields. */
export const venuesForSave = (venues: AcademyVenueInput[]): AcademyVenueInput[] =>
  venues.map((venue) => ({
    ...venue,
    name: venue.name.trim(),
    address: venue.address.trim(),
    city: venue.city.trim(),
    state: normalizeStateName(venue.state) ?? venue.state.trim(),
    pincode: venue.pincode.trim(),
    description: (venue.description ?? "").trim(),
    coverPhotoKey: venue.coverPhotoKey ?? "",
  }));
