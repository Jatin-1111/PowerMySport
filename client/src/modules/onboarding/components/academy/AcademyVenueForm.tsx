"use client";

import {
  INDIAN_STATES_AND_UTS,
  normalizeStateName,
  normalizeStoredState,
} from "@/lib/indianStates";
import { geoApi, type GeoSuggestion } from "@/modules/geo/services/geo";
import OpeningHoursInput from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { AcademyPhotoSlots } from "@/modules/onboarding/components/academy/AcademyPhotoSlots";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import type { AcademyVenueInput } from "@/modules/onboarding/types/academy";
import {
  MAX_DESCRIPTION_LENGTH,
  MIN_GENERAL_PHOTOS,
  MIN_SPORT_PHOTOS,
  createEmptyVenue,
  paiseToRupees,
  rupeesToPaise,
  withSports,
  type VenueErrors,
} from "@/modules/onboarding/utils/academyVenueRules";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { SUPPORTED_SPORT_NAMES } from "@/modules/sports/config/supportedSports";
import { useEffect, useRef, useState } from "react";

const AMENITIES = [
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

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none disabled:bg-slate-100";
const label = "mb-1 block text-xs font-semibold text-slate-700";

interface AcademyVenueFormProps {
  academyId: string;
  index: number;
  venue: AcademyVenueInput;
  onChange: (updater: (venue: AcademyVenueInput) => AcademyVenueInput) => void;
  onRemove?: () => void;
  /** Validation messages for this venue, shown once the owner has tried to continue. */
  errors: VenueErrors;
  showErrors: boolean;
  disabled?: boolean;
}

const Error_ = ({ message }: { message?: string | undefined }) =>
  message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;

/** One facility: where it is, what it offers, when it is open, and its photos. */
export function AcademyVenueForm({
  academyId,
  index,
  venue,
  onChange,
  onRemove,
  errors,
  showErrors,
  disabled = false,
}: AcademyVenueFormProps) {
  const id = (name: string) => `venue-${index}-${name}`;
  const err = <K extends keyof VenueErrors>(key: K) =>
    showErrors ? (errors[key] as string | undefined) : undefined;

  const [priceText, setPriceText] = useState(String(paiseToRupees(venue.pricePerHour)));
  const [addressText, setAddressText] = useState(venue.address);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const skipSearch = useRef(false);

  const [uploadingGeneral, setUploadingGeneral] = useState(false);
  const [uploadingSport, setUploadingSport] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  // Address search, once the owner has typed enough and paused.
  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const query = addressText.trim();
    if (query.length < 3) return;
    let live = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geoApi.autocomplete(query);
        if (live) setSuggestions(results);
      } catch {
        if (live) setSuggestions([]);
      } finally {
        if (live) setSearching(false);
      }
    }, 350);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [addressText]);

  const onAddressTyped = (value: string) => {
    setAddressText(value);
    if (value.trim().length < 3) setSuggestions([]);
    // Typing again means the earlier map pick no longer matches the text, so the
    // owner has to pick again.
    onChange((v) => ({
      ...v,
      address: value,
      placeId: "",
      location: createEmptyVenue().location,
    }));
  };

  const pickSuggestion = (s: GeoSuggestion) => {
    skipSearch.current = true;
    setAddressText(s.label);
    setSuggestions([]);
    onChange((v) => ({
      ...v,
      address: s.label,
      placeId: s.placeId ?? "",
      location: { type: "Point", coordinates: [s.lon, s.lat] },
      city: s.city?.trim() || v.city,
      state: (s.state && normalizeStateName(s.state)) || v.state,
      pincode: s.pincode && /^\d{6}$/.test(s.pincode) ? s.pincode : v.pincode,
    }));
  };

  // ── Photos ─────────────────────────────────────────────────────────────────

  const setUploadError = (key: string, message: string) =>
    setUploadErrors((prev) => ({ ...prev, [key]: message }));

  const addPhotos = async (kind: "general" | "sport", sport: string | undefined, files: File[]) => {
    const key = kind === "general" ? "general" : `sport:${sport}`;
    setUploadError(key, "");
    if (kind === "general") setUploadingGeneral(true);
    else setUploadingSport((prev) => ({ ...prev, [sport!]: true }));

    const problems: string[] = [];
    for (const file of files) {
      try {
        const { url, key: storageKey } = await academyOnboardingApi.uploadVenuePhoto(
          academyId,
          kind,
          file
        );
        onChange((v) => {
          if (kind === "general") {
            const generalImages = [...v.generalImages, url];
            const generalImageKeys = [...v.generalImageKeys, storageKey];
            // The first general photo is the cover until the owner picks another.
            const hasCover = v.coverPhotoUrl && v.generalImages.includes(v.coverPhotoUrl);
            return {
              ...v,
              generalImages,
              generalImageKeys,
              coverPhotoUrl: hasCover ? v.coverPhotoUrl : url,
              coverPhotoKey: hasCover ? (v.coverPhotoKey ?? "") : storageKey,
            };
          }
          return {
            ...v,
            sportImages: { ...v.sportImages, [sport!]: [...(v.sportImages[sport!] ?? []), url] },
            sportImageKeys: {
              ...v.sportImageKeys,
              [sport!]: [...(v.sportImageKeys[sport!] ?? []), storageKey],
            },
          };
        });
      } catch (error) {
        problems.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`);
      }
    }

    if (problems.length > 0) setUploadError(key, problems.join(" "));
    if (kind === "general") setUploadingGeneral(false);
    else setUploadingSport((prev) => ({ ...prev, [sport!]: false }));
  };

  const removeGeneral = (at: number) =>
    onChange((v) => {
      const removed = v.generalImages[at];
      const generalImages = v.generalImages.filter((_, i) => i !== at);
      const generalImageKeys = v.generalImageKeys.filter((_, i) => i !== at);
      const wasCover = removed === v.coverPhotoUrl;
      const coverPhotoUrl = wasCover ? (generalImages[0] ?? "") : v.coverPhotoUrl;
      const coverPhotoKey = wasCover ? (generalImageKeys[0] ?? "") : (v.coverPhotoKey ?? "");
      return { ...v, generalImages, generalImageKeys, coverPhotoUrl, coverPhotoKey };
    });

  const makeCover = (url: string) =>
    onChange((v) => {
      const at = v.generalImages.indexOf(url);
      return at < 0 ? v : { ...v, coverPhotoUrl: url, coverPhotoKey: v.generalImageKeys[at] ?? "" };
    });

  const removeSport = (sport: string, at: number) =>
    onChange((v) => ({
      ...v,
      sportImages: {
        ...v.sportImages,
        [sport]: (v.sportImages[sport] ?? []).filter((_, i) => i !== at),
      },
      sportImageKeys: {
        ...v.sportImageKeys,
        [sport]: (v.sportImageKeys[sport] ?? []).filter((_, i) => i !== at),
      },
    }));

  const anyUploading = uploadingGeneral || Object.values(uploadingSport).some(Boolean);

  return (
    <fieldset className="space-y-5 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <legend className="text-base font-semibold text-slate-900">Venue {index + 1}</legend>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled || anyUploading}
            className="text-sm text-red-600 underline underline-offset-2 disabled:opacity-50"
          >
            Remove venue
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor={id("name")} className={label}>
            Venue name
          </label>
          <input
            id={id("name")}
            className={field}
            value={venue.name}
            disabled={disabled}
            onChange={(e) => onChange((v) => ({ ...v, name: e.target.value }))}
          />
          <Error_ message={err("name")} />
        </div>

        <div className="relative md:col-span-2">
          <label htmlFor={id("address")} className={label}>
            Address
          </label>
          <input
            id={id("address")}
            className={field}
            value={addressText}
            disabled={disabled}
            autoComplete="off"
            placeholder="Start typing, then pick your address from the list"
            onChange={(e) => onAddressTyped(e.target.value)}
          />
          {searching && <p className="mt-1 text-xs text-slate-500">Searching</p>}
          {suggestions.length > 0 && (
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {suggestions.map((s) => (
                <li key={`${s.label}-${s.lat}-${s.lon}`}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Error_ message={err("address") ?? err("location")} />
        </div>

        <div>
          <label htmlFor={id("city")} className={label}>
            City
          </label>
          <input
            id={id("city")}
            className={field}
            value={venue.city}
            disabled={disabled}
            onChange={(e) => onChange((v) => ({ ...v, city: e.target.value }))}
          />
          <Error_ message={err("city")} />
        </div>

        <div>
          <label htmlFor={id("state")} className={label}>
            State
          </label>
          <select
            id={id("state")}
            className={field}
            value={normalizeStoredState(venue.state)}
            disabled={disabled}
            onChange={(e) => onChange((v) => ({ ...v, state: e.target.value }))}
          >
            <option value="">Choose a state</option>
            {INDIAN_STATES_AND_UTS.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <Error_ message={err("state")} />
        </div>

        <div>
          <label htmlFor={id("pincode")} className={label}>
            Pincode
          </label>
          <input
            id={id("pincode")}
            className={field}
            inputMode="numeric"
            maxLength={6}
            value={venue.pincode}
            disabled={disabled}
            onChange={(e) =>
              onChange((v) => ({ ...v, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))
            }
          />
          <Error_ message={err("pincode")} />
        </div>

        <div>
          <label htmlFor={id("price")} className={label}>
            Price per hour (₹)
          </label>
          <input
            id={id("price")}
            className={field}
            inputMode="decimal"
            value={priceText}
            disabled={disabled}
            onChange={(e) => {
              setPriceText(e.target.value);
              const paise = rupeesToPaise(e.target.value);
              onChange((v) => ({ ...v, pricePerHour: paise }));
            }}
          />
          <Error_ message={err("price")} />
        </div>
      </div>

      <div>
        <span className={label}>Sports</span>
        <SportsMultiSelect
          value={venue.sports}
          allowedSports={[...SUPPORTED_SPORT_NAMES]}
          disabled={disabled}
          onChange={(sports) => onChange((v) => withSports(v, sports))}
        />
        <Error_ message={err("sports")} />
      </div>

      <div>
        <span className={label}>Amenities</span>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((amenity) => {
            const on = venue.amenities.includes(amenity);
            return (
              <button
                key={amenity}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() =>
                  onChange((v) => ({
                    ...v,
                    amenities: on
                      ? v.amenities.filter((a) => a !== amenity)
                      : [...v.amenities, amenity],
                  }))
                }
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  on
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                }`}
              >
                {amenity}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className={label}>Opening hours</span>
        <OpeningHoursInput
          value={venue.openingHours}
          onChange={(openingHours) => onChange((v) => ({ ...v, openingHours }))}
        />
        <Error_ message={err("hours")} />
      </div>

      <div>
        <label htmlFor={id("description")} className={label}>
          Description (optional)
        </label>
        <textarea
          id={id("description")}
          rows={3}
          className={field}
          value={venue.description ?? ""}
          disabled={disabled}
          onChange={(e) => onChange((v) => ({ ...v, description: e.target.value }))}
        />
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <Error_ message={err("description")} />
          <span>
            {(venue.description ?? "").length} / {MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={venue.allowExternalCoaches}
          disabled={disabled}
          onChange={(e) => onChange((v) => ({ ...v, allowExternalCoaches: e.target.checked }))}
        />
        Allow coaches from outside the academy to book this venue
      </label>

      <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Photos</p>
          <p className="text-xs text-slate-500">
            {MIN_GENERAL_PHOTOS} photos of the venue, and {MIN_SPORT_PHOTOS} for each sport. JPG or
            PNG, up to 5 MB each.
          </p>
        </div>

        <AcademyPhotoSlots
          label="General photos"
          urls={venue.generalImages}
          need={MIN_GENERAL_PHOTOS}
          capacity={MIN_GENERAL_PHOTOS}
          coverUrl={venue.coverPhotoUrl}
          onSetCover={makeCover}
          onAdd={(files) => void addPhotos("general", undefined, files)}
          onRemove={removeGeneral}
          uploading={uploadingGeneral}
          uploadError={uploadErrors.general}
          error={err("generalPhotos") ?? err("cover")}
          disabled={disabled}
        />

        {venue.sports.map((sport) => (
          <AcademyPhotoSlots
            key={sport}
            label={`${sport} photos`}
            urls={venue.sportImages[sport] ?? []}
            need={MIN_SPORT_PHOTOS}
            capacity={MIN_SPORT_PHOTOS}
            onAdd={(files) => void addPhotos("sport", sport, files)}
            onRemove={(at) => removeSport(sport, at)}
            uploading={Boolean(uploadingSport[sport])}
            uploadError={uploadErrors[`sport:${sport}`]}
            error={showErrors ? errors.sportPhotos?.[sport] : undefined}
            disabled={disabled}
          />
        ))}
      </div>
    </fieldset>
  );
}
