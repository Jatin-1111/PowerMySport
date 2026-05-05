"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import AmenitiesMultiSelect from "@/modules/shared/components/AmenitiesMultiSelect";
import { Camera, Loader, Trash2, Upload } from "lucide-react";
import OpeningHoursInput, {
  getDefaultOpeningHours,
} from "@/modules/onboarding/components/OpeningHoursInput";
import type {
  AcademyOwnedVenueInput,
  AcademyStep4Payload,
} from "@/modules/onboarding/types/academy";

interface Step4VenuesProps {
  academyId: string;
  onSubmit: (data: AcademyStep4Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep4Payload;
}

const MAX_GENERAL_IMAGES = 3;
const MAX_SPORT_IMAGES = 5;

const createEmptyVenue = (): AcademyOwnedVenueInput => ({
  name: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  placeId: "",
  location: {
    type: "Point",
    coordinates: [77.2, 28.7],
  },
  sports: [],
  pricePerHour: 0,
  sportPricing: {},
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

export default function Step4Venues({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step4VenuesProps) {
  const [venues, setVenues] = useState<AcademyOwnedVenueInput[]>(
    previousData?.academyVenues?.length
      ? previousData.academyVenues
      : [createEmptyVenue()],
  );
  const [addressQueries, setAddressQueries] = useState<string[]>(
    previousData?.academyVenues?.length
      ? previousData.academyVenues.map((venue) => venue.address)
      : [""],
  );
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState<Record<string, boolean>>({});
  const skipAutocompleteRef = useRef(false);

  useEffect(() => {
    if (activeSuggestionIndex < 0) {
      setSuggestions([]);
      return;
    }

    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const query = (addressQueries[activeSuggestionIndex] || "").trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await geoApi.autocomplete(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [activeSuggestionIndex, addressQueries]);

  const updateVenue = (
    index: number,
    updater: (venue: AcademyOwnedVenueInput) => AcademyOwnedVenueInput,
  ) => {
    setVenues((prev) =>
      prev.map((venue, currentIndex) =>
        currentIndex === index ? updater(venue) : venue,
      ),
    );
  };

  const getCoverKeyFromImages = (
    imageUrls: string[],
    imageKeys: string[],
    coverUrl: string,
    fallback: string,
  ) => {
    const coverIndex = imageUrls.findIndex((url) => url === coverUrl);
    return coverIndex >= 0 ? imageKeys[coverIndex] || fallback : fallback;
  };

  const getSlotKey = (
    index: number,
    type: "general" | "sport",
    slotIndex: number,
    sport?: string,
  ) => `venue-${index}-${type}${sport ? `-${sport}` : ""}-${slotIndex}`;

  const setUploadState = (key: string, value: boolean) =>
    setUploading((prev) => ({ ...prev, [key]: value }));

  const setDragState = (key: string, value: boolean) =>
    setDragActive((prev) => ({ ...prev, [key]: value }));

  const setUploadError = (key: string, message: string) =>
    setUploadErrors((prev) => ({ ...prev, [key]: message }));

  const validateImageFile = (file: File, maxSizeBytes: number) => {
    if (!file.type.startsWith("image/")) {
      return "Only image files are allowed";
    }

    if (file.size > maxSizeBytes) {
      const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
      return `Image must be smaller than ${maxMb}MB`;
    }

    return "";
  };

  const fetchUploadUrls = async (imageTypes: string[]) => {
    const response = await academyOnboardingApi.getImageUploadUrls(
      academyId,
      imageTypes,
    );

    if (!response.success || !response.data?.uploadUrls?.length) {
      throw new Error("Failed to prepare image uploads");
    }

    return response.data.uploadUrls;
  };

  const uploadGeneralImageAtSlot = async (
    index: number,
    slotIndex: number,
    file?: File | null,
    minFilledSlots?: number,
  ): Promise<boolean> => {
    if (!file) return false;

    const venue = venues[index];
    const slotKey = getSlotKey(index, "general", slotIndex);
    const allowedSlots =
      typeof minFilledSlots === "number"
        ? minFilledSlots
        : venue.generalImages.length;

    if (slotIndex > allowedSlots) {
      setUploadError(slotKey, "Upload previous images first");
      return false;
    }

    setUploadState(slotKey, true);
    setUploadError(slotKey, "");

    try {
      const uploadUrls = await fetchUploadUrls(["academyVenue_general"]);
      const candidates = uploadUrls.filter((url) =>
        url.field.startsWith("academyVenue_general"),
      );
      const upload = candidates[slotIndex] || candidates[0];

      if (!upload) {
        throw new Error("No upload slots available");
      }

      const fileError = validateImageFile(file, upload.maxSizeBytes);
      if (fileError) {
        setUploadError(slotKey, fileError);
        return false;
      }

      await uploadFileToPresignedUrl(
        file,
        upload.uploadUrl,
        upload.contentType,
      );

      updateVenue(index, (v) => {
        const nextImages = [...v.generalImages];
        const nextKeys = [...v.generalImageKeys];
        const replacing = slotIndex < nextImages.length;
        const previousUrl = replacing ? nextImages[slotIndex] : "";

        if (replacing) {
          nextImages[slotIndex] = upload.downloadUrl;
          nextKeys[slotIndex] = upload.s3Key;
        } else {
          nextImages.push(upload.downloadUrl);
          nextKeys.push(upload.s3Key);
        }

        let nextCoverUrl = v.coverPhotoUrl || nextImages[0] || "";
        if (previousUrl && v.coverPhotoUrl === previousUrl) {
          nextCoverUrl = upload.downloadUrl;
        }

        const nextCoverKey = nextCoverUrl
          ? getCoverKeyFromImages(
              nextImages,
              nextKeys,
              nextCoverUrl,
              v.coverPhotoKey || "",
            )
          : "";

        return {
          ...v,
          generalImages: nextImages,
          generalImageKeys: nextKeys,
          coverPhotoUrl: nextCoverUrl,
          coverPhotoKey: nextCoverKey,
        };
      });

      return true;
    } catch (error) {
      setUploadError(
        slotKey,
        error instanceof Error ? error.message : "Upload failed",
      );
      return false;
    } finally {
      setUploadState(slotKey, false);
    }
  };

  const uploadGeneralImagesBatchFromSlot = async (
    index: number,
    startSlot: number,
    files?: FileList | null,
  ) => {
    if (!files || files.length === 0) return;

    const venue = venues[index];
    const remaining = MAX_GENERAL_IMAGES - venue.generalImages.length;

    if (remaining <= 0) {
      setUploadError(
        getSlotKey(index, "general", startSlot),
        "All general image slots are filled",
      );
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    let expectedLength = venue.generalImages.length;

    for (let i = 0; i < selected.length; i += 1) {
      const slotIndex = startSlot + i;
      if (slotIndex >= MAX_GENERAL_IMAGES) break;

      const success = await uploadGeneralImageAtSlot(
        index,
        slotIndex,
        selected[i],
        expectedLength,
      );

      if (success && slotIndex >= expectedLength) {
        expectedLength += 1;
      }
    }
  };

  const uploadSportImageAtSlot = async (
    index: number,
    sport: string,
    slotIndex: number,
    file?: File | null,
    minFilledSlots?: number,
  ): Promise<boolean> => {
    if (!file) return false;

    const venue = venues[index];
    const current = venue.sportImages[sport] || [];
    const slotKey = getSlotKey(index, "sport", slotIndex, sport);
    const allowedSlots =
      typeof minFilledSlots === "number" ? minFilledSlots : current.length;

    if (slotIndex > allowedSlots) {
      setUploadError(slotKey, "Upload previous images first");
      return false;
    }

    setUploadState(slotKey, true);
    setUploadError(slotKey, "");

    try {
      const uploadUrls = await fetchUploadUrls(["academyVenue_sport"]);
      const candidates = uploadUrls.filter((url) =>
        url.field.startsWith("academyVenue_sport"),
      );
      const upload = candidates[slotIndex] || candidates[0];

      if (!upload) {
        throw new Error("No upload slots available");
      }

      const fileError = validateImageFile(file, upload.maxSizeBytes);
      if (fileError) {
        setUploadError(slotKey, fileError);
        return false;
      }

      await uploadFileToPresignedUrl(
        file,
        upload.uploadUrl,
        upload.contentType,
      );

      updateVenue(index, (v) => {
        const nextImages = [...(v.sportImages[sport] || [])];
        const nextKeys = [...(v.sportImageKeys[sport] || [])];

        if (slotIndex < nextImages.length) {
          nextImages[slotIndex] = upload.downloadUrl;
          nextKeys[slotIndex] = upload.s3Key;
        } else {
          nextImages.push(upload.downloadUrl);
          nextKeys.push(upload.s3Key);
        }

        return {
          ...v,
          sportImages: {
            ...v.sportImages,
            [sport]: nextImages,
          },
          sportImageKeys: {
            ...v.sportImageKeys,
            [sport]: nextKeys,
          },
        };
      });

      return true;
    } catch (error) {
      setUploadError(
        slotKey,
        error instanceof Error ? error.message : "Upload failed",
      );
      return false;
    } finally {
      setUploadState(slotKey, false);
    }
  };

  const uploadSportImagesBatchFromSlot = async (
    index: number,
    sport: string,
    startSlot: number,
    files?: FileList | null,
  ) => {
    if (!files || files.length === 0) return;

    const venue = venues[index];
    const current = venue.sportImages[sport] || [];
    const remaining = MAX_SPORT_IMAGES - current.length;

    if (remaining <= 0) {
      setUploadError(
        getSlotKey(index, "sport", startSlot, sport),
        "All sport image slots are filled",
      );
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    let expectedLength = current.length;

    for (let i = 0; i < selected.length; i += 1) {
      const slotIndex = startSlot + i;
      if (slotIndex >= MAX_SPORT_IMAGES) break;

      const success = await uploadSportImageAtSlot(
        index,
        sport,
        slotIndex,
        selected[i],
        expectedLength,
      );

      if (success && slotIndex >= expectedLength) {
        expectedLength += 1;
      }
    }
  };

  const removeGeneralImage = (index: number, imageIndex: number) => {
    updateVenue(index, (v) => {
      const nextImages = v.generalImages.filter((_, i) => i !== imageIndex);
      const nextKeys = v.generalImageKeys.filter((_, i) => i !== imageIndex);
      const removedUrl = v.generalImages[imageIndex];
      const nextCoverUrl =
        v.coverPhotoUrl === removedUrl ? nextImages[0] || "" : v.coverPhotoUrl;
      const nextCoverKey = nextCoverUrl
        ? getCoverKeyFromImages(nextImages, nextKeys, nextCoverUrl, "")
        : "";

      return {
        ...v,
        generalImages: nextImages,
        generalImageKeys: nextKeys,
        coverPhotoUrl: nextCoverUrl,
        coverPhotoKey: nextCoverKey,
      };
    });
  };

  const removeSportImage = (
    index: number,
    sport: string,
    imageIndex: number,
  ) => {
    updateVenue(index, (v) => {
      const nextImages = (v.sportImages[sport] || []).filter(
        (_, i) => i !== imageIndex,
      );
      const nextKeys = (v.sportImageKeys[sport] || []).filter(
        (_, i) => i !== imageIndex,
      );

      return {
        ...v,
        sportImages: {
          ...v.sportImages,
          [sport]: nextImages,
        },
        sportImageKeys: {
          ...v.sportImageKeys,
          [sport]: nextKeys,
        },
      };
    });
  };

  const ensureAddressQueriesLength = (nextLength: number) => {
    setAddressQueries((prev) => {
      const copy = [...prev];
      while (copy.length < nextLength) copy.push("");
      return copy.slice(0, nextLength);
    });
  };

  const addVenue = () => {
    setVenues((prev) => {
      const next = [...prev, createEmptyVenue()];
      ensureAddressQueriesLength(next.length);
      return next;
    });
  };

  const removeVenue = (index: number) => {
    setVenues((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
    setAddressQueries((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
    if (activeSuggestionIndex === index) {
      setActiveSuggestionIndex(-1);
      setSuggestions([]);
    }
  };

  const handleAddressQueryChange = (index: number, value: string) => {
    setAddressQueries((prev) =>
      prev.map((query, currentIndex) =>
        currentIndex === index ? value : query,
      ),
    );
    setActiveSuggestionIndex(index);
    updateVenue(index, (venue) => ({
      ...venue,
      address: value,
    }));
  };

  const handleSuggestionSelect = (index: number, suggestion: GeoSuggestion) => {
    skipAutocompleteRef.current = true;
    setAddressQueries((prev) =>
      prev.map((query, currentIndex) =>
        currentIndex === index ? suggestion.label : query,
      ),
    );
    updateVenue(index, (venue) => ({
      ...venue,
      address: suggestion.label,
      location: {
        type: "Point",
        coordinates: [suggestion.lon, suggestion.lat],
      },
    }));
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!venues.length) {
      errors.venues = "Add at least one venue";
    }

    venues.forEach((venue, index) => {
      const key = `venue_${index}`;
      if (!venue.name.trim()) errors[`${key}_name`] = "Venue name is required";
      if (!venue.address.trim())
        errors[`${key}_address`] = "Venue address is required";
      if (!venue.city.trim()) errors[`${key}_city`] = "City is required";
      if (!venue.state.trim()) errors[`${key}_state`] = "State is required";
      if (!/^\d{6}$/.test(venue.pincode)) {
        errors[`${key}_pincode`] = "Pincode must be 6 digits";
      }
      if (!venue.sports.length) {
        errors[`${key}_sports`] = "Select at least one sport";
      }
      if (!venue.pricePerHour || venue.pricePerHour < 100) {
        errors[`${key}_pricePerHour`] = "Price per hour must be at least Rs 1";
      }
      if (!venue.coverPhotoUrl.trim()) {
        errors[`${key}_coverPhotoUrl`] =
          "Select a cover photo from the uploaded S3 images";
      }
      if (venue.generalImages.length < 3) {
        errors[`${key}_generalImages`] =
          "At least 3 general images are required";
      }
      for (const sport of venue.sports) {
        if (!venue.sportImages[sport] || venue.sportImages[sport].length < 5) {
          errors[`${key}_sportImages_${sport}`] =
            `Add at least 5 images for ${sport}`;
        }
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) {
      toast.error("Please fix venue details before continuing");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        academyId,
        academyVenues: venues,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save venues",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">
          Step 4: Venue Details
        </h2>
        <p className="text-slate-600">
          Add full venue onboarding details, including sports, amenities, maps
          location, and image uploads.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Academy Venues
          </h3>
          <Button
            type="button"
            variant="outline"
            onClick={addVenue}
            disabled={isSubmitting || loading}
          >
            Add Venue
          </Button>
        </div>

        {fieldErrors.venues ? (
          <p className="text-xs text-red-600">{fieldErrors.venues}</p>
        ) : null}

        {venues.map((venue, index) => (
          <div
            key={`academy-venue-${index}`}
            className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">
                Venue {index + 1}
              </h4>
              <button
                type="button"
                className="text-sm text-red-600 disabled:text-slate-400"
                onClick={() => removeVenue(index)}
                disabled={venues.length === 1 || isSubmitting || loading}
              >
                Remove
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={venue.name}
                onChange={(e) =>
                  updateVenue(index, (v) => ({ ...v, name: e.target.value }))
                }
                placeholder="Venue name"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <div className="md:col-span-2">
                <input
                  type="text"
                  value={addressQueries[index] || ""}
                  onChange={(e) =>
                    handleAddressQueryChange(index, e.target.value)
                  }
                  onFocus={() => setActiveSuggestionIndex(index)}
                  placeholder="Search venue address (Google Maps API)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={isSubmitting || loading}
                />
                {isSearching && activeSuggestionIndex === index ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Searching location...
                  </p>
                ) : null}
                {activeSuggestionIndex === index && suggestions.length > 0 ? (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {suggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                        type="button"
                        onClick={() =>
                          handleSuggestionSelect(index, suggestion)
                        }
                        className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {fieldErrors[`venue_${index}_address`] ? (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors[`venue_${index}_address`]}
                  </p>
                ) : null}
              </div>
              <input
                type="text"
                value={venue.city}
                onChange={(e) =>
                  updateVenue(index, (v) => ({ ...v, city: e.target.value }))
                }
                placeholder="City"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <input
                type="text"
                value={venue.state}
                onChange={(e) =>
                  updateVenue(index, (v) => ({ ...v, state: e.target.value }))
                }
                placeholder="State"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <input
                type="text"
                value={venue.pincode}
                onChange={(e) =>
                  updateVenue(index, (v) => ({ ...v, pincode: e.target.value }))
                }
                placeholder="Pincode"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <input
                type="number"
                min={1}
                value={venue.pricePerHour ? venue.pricePerHour / 100 : ""}
                onChange={(e) =>
                  updateVenue(index, (v) => ({
                    ...v,
                    pricePerHour: Math.round(Number(e.target.value || 0) * 100),
                  }))
                }
                placeholder="Price per hour"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">
                Sports *
              </label>
              <SportsMultiSelect
                value={venue.sports}
                onChange={(sports) =>
                  updateVenue(index, (v) => ({
                    ...v,
                    sports,
                    sportImages: Object.fromEntries(
                      sports.map((sport) => [
                        sport,
                        v.sportImages[sport] || [],
                      ]),
                    ),
                    sportImageKeys: Object.fromEntries(
                      sports.map((sport) => [
                        sport,
                        v.sportImageKeys[sport] || [],
                      ]),
                    ),
                  }))
                }
                disabled={isSubmitting || loading}
                required
              />
              {fieldErrors[`venue_${index}_sports`] ? (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrors[`venue_${index}_sports`]}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">
                Amenities
              </label>
              <AmenitiesMultiSelect
                value={venue.amenities}
                onChange={(amenities) =>
                  updateVenue(index, (v) => ({ ...v, amenities }))
                }
                disabled={isSubmitting || loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">
                Opening Hours
              </label>
              <OpeningHoursInput
                value={venue.openingHours}
                onChange={(openingHours) =>
                  updateVenue(index, (v) => ({ ...v, openingHours }))
                }
              />
            </div>

            <textarea
              value={venue.description || ""}
              onChange={(e) =>
                updateVenue(index, (v) => ({
                  ...v,
                  description: e.target.value,
                }))
              }
              placeholder="Venue description"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={isSubmitting || loading}
            />

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={venue.allowExternalCoaches}
                onChange={(e) =>
                  updateVenue(index, (v) => ({
                    ...v,
                    allowExternalCoaches: e.target.checked,
                  }))
                }
                disabled={isSubmitting || loading}
              />
              Allow external coaches
            </label>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">
                  Venue Photos
                </p>
                <p className="text-xs text-slate-500">
                  Upload 3 general images and 5 per sport.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-900">
                    Venue Images (3 required)
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: MAX_GENERAL_IMAGES }).map(
                      (_, slotIndex) => {
                        const slotKey = getSlotKey(index, "general", slotIndex);
                        const slotUploading = uploading[slotKey];
                        const slotDragActive = dragActive[slotKey];
                        const slotError = uploadErrors[slotKey];
                        const imageUrl = venue.generalImages[slotIndex];
                        const slotEnabled =
                          slotIndex <= venue.generalImages.length &&
                          !isSubmitting &&
                          !loading;

                        return (
                          <div key={`general-${index}-${slotIndex}`}>
                            {imageUrl ? (
                              <div className="relative aspect-square">
                                <img
                                  src={imageUrl}
                                  alt={`General ${slotIndex + 1}`}
                                  className="h-full w-full rounded-lg border border-slate-200 object-cover"
                                />
                                {venue.coverPhotoUrl === imageUrl ? (
                                  <span className="absolute bottom-2 left-2 rounded bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    Cover
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeGeneralImage(index, slotIndex)
                                  }
                                  className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <label
                                className={`flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed text-center text-xs transition ${
                                  slotDragActive
                                    ? "border-power-orange bg-power-orange/5"
                                    : "border-slate-300"
                                } ${slotEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  if (!slotEnabled) return;
                                  setDragState(slotKey, true);
                                }}
                                onDragLeave={(event) => {
                                  event.preventDefault();
                                  setDragState(slotKey, false);
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  setDragState(slotKey, false);
                                  if (!slotEnabled) return;
                                  const files = event.dataTransfer.files;
                                  if (files && files.length > 1) {
                                    uploadGeneralImagesBatchFromSlot(
                                      index,
                                      slotIndex,
                                      files,
                                    );
                                    return;
                                  }
                                  uploadGeneralImageAtSlot(
                                    index,
                                    slotIndex,
                                    files?.[0],
                                  );
                                }}
                              >
                                {slotUploading ? (
                                  <Loader
                                    className="mb-2 animate-spin text-power-orange"
                                    size={22}
                                  />
                                ) : (
                                  <Upload
                                    className="mb-2 text-slate-400"
                                    size={22}
                                  />
                                )}
                                <span className="text-slate-600">
                                  Image {slotIndex + 1}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  disabled={!slotEnabled}
                                  onChange={(event) => {
                                    const files = event.target.files;
                                    if (files && files.length > 1) {
                                      uploadGeneralImagesBatchFromSlot(
                                        index,
                                        slotIndex,
                                        files,
                                      );
                                      return;
                                    }
                                    uploadGeneralImageAtSlot(
                                      index,
                                      slotIndex,
                                      files?.[0],
                                    );
                                  }}
                                />
                              </label>
                            )}
                            {slotError ? (
                              <p className="mt-1 text-xs text-red-600">
                                {slotError}
                              </p>
                            ) : null}
                          </div>
                        );
                      },
                    )}
                  </div>
                  {venue.generalImages.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>Set cover photo:</span>
                      <select
                        value={venue.coverPhotoUrl || ""}
                        onChange={(e) => {
                          const selectedUrl = e.target.value;
                          const selectedIndex = venue.generalImages.findIndex(
                            (imageUrl) => imageUrl === selectedUrl,
                          );

                          updateVenue(index, (v) => ({
                            ...v,
                            coverPhotoUrl: selectedUrl,
                            coverPhotoKey:
                              selectedIndex >= 0
                                ? v.generalImageKeys[selectedIndex] || ""
                                : v.coverPhotoKey || "",
                          }));
                        }}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        disabled={isSubmitting || loading}
                      >
                        <option value="">Choose image</option>
                        {venue.generalImages.map((imageUrl, imageIndex) => (
                          <option
                            key={`${index}-cover-${imageIndex}`}
                            value={imageUrl}
                          >
                            Image {imageIndex + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {fieldErrors[`venue_${index}_coverPhotoUrl`] ? (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldErrors[`venue_${index}_coverPhotoUrl`]}
                    </p>
                  ) : null}
                  {fieldErrors[`venue_${index}_generalImages`] ? (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldErrors[`venue_${index}_generalImages`]}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1">
                      <Upload size={14} className="text-slate-500" />
                      Upload multiple images
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={
                          isSubmitting ||
                          loading ||
                          venue.generalImages.length >= MAX_GENERAL_IMAGES
                        }
                        onChange={(event) =>
                          uploadGeneralImagesBatchFromSlot(
                            index,
                            venue.generalImages.length,
                            event.target.files,
                          )
                        }
                      />
                    </label>
                    <span>Fills the next available slots.</span>
                  </div>
                </div>

                {venue.sports.map((sport) => {
                  const sportImages = venue.sportImages[sport] || [];

                  return (
                    <div key={`${index}-${sport}`} className="pt-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {sport} Images ({sportImages.length}/
                          {MAX_SPORT_IMAGES})
                        </p>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {Array.from({ length: MAX_SPORT_IMAGES }).map(
                          (_, slotIndex) => {
                            const slotKey = getSlotKey(
                              index,
                              "sport",
                              slotIndex,
                              sport,
                            );
                            const slotUploading = uploading[slotKey];
                            const slotDragActive = dragActive[slotKey];
                            const slotError = uploadErrors[slotKey];
                            const imageUrl = sportImages[slotIndex];
                            const slotEnabled =
                              slotIndex <= sportImages.length &&
                              !isSubmitting &&
                              !loading;

                            return (
                              <div key={`${sport}-${slotIndex}`}>
                                {imageUrl ? (
                                  <div className="relative aspect-square">
                                    <img
                                      src={imageUrl}
                                      alt={`${sport} ${slotIndex + 1}`}
                                      className="h-full w-full rounded-lg border border-slate-200 object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeSportImage(
                                          index,
                                          sport,
                                          slotIndex,
                                        )
                                      }
                                      className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <label
                                    className={`flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed text-center text-xs transition ${
                                      slotDragActive
                                        ? "border-power-orange bg-power-orange/5"
                                        : "border-slate-300"
                                    } ${slotEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                                    onDragOver={(event) => {
                                      event.preventDefault();
                                      if (!slotEnabled) return;
                                      setDragState(slotKey, true);
                                    }}
                                    onDragLeave={(event) => {
                                      event.preventDefault();
                                      setDragState(slotKey, false);
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      setDragState(slotKey, false);
                                      if (!slotEnabled) return;
                                      const files = event.dataTransfer.files;
                                      if (files && files.length > 1) {
                                        uploadSportImagesBatchFromSlot(
                                          index,
                                          sport,
                                          slotIndex,
                                          files,
                                        );
                                        return;
                                      }
                                      uploadSportImageAtSlot(
                                        index,
                                        sport,
                                        slotIndex,
                                        files?.[0],
                                      );
                                    }}
                                  >
                                    {slotUploading ? (
                                      <Loader
                                        className="mb-2 animate-spin text-power-orange"
                                        size={18}
                                      />
                                    ) : (
                                      <Camera
                                        className="mb-2 text-slate-400"
                                        size={18}
                                      />
                                    )}
                                    <span className="text-slate-600">
                                      Image {slotIndex + 1}
                                    </span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      disabled={!slotEnabled}
                                      onChange={(event) => {
                                        const files = event.target.files;
                                        if (files && files.length > 1) {
                                          uploadSportImagesBatchFromSlot(
                                            index,
                                            sport,
                                            slotIndex,
                                            files,
                                          );
                                          return;
                                        }
                                        uploadSportImageAtSlot(
                                          index,
                                          sport,
                                          slotIndex,
                                          files?.[0],
                                        );
                                      }}
                                    />
                                  </label>
                                )}
                                {slotError ? (
                                  <p className="mt-1 text-xs text-red-600">
                                    {slotError}
                                  </p>
                                ) : null}
                              </div>
                            );
                          },
                        )}
                      </div>
                      {fieldErrors[`venue_${index}_sportImages_${sport}`] ? (
                        <p className="mt-1 text-xs text-red-600">
                          {fieldErrors[`venue_${index}_sportImages_${sport}`]}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1">
                          <Camera size={14} className="text-slate-500" />
                          Upload multiple images
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={
                              isSubmitting ||
                              loading ||
                              sportImages.length >= MAX_SPORT_IMAGES
                            }
                            onChange={(event) =>
                              uploadSportImagesBatchFromSlot(
                                index,
                                sport,
                                sportImages.length,
                                event.target.files,
                              )
                            }
                          />
                        </label>
                        <span>Fills the next available slots.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-3 pt-4">
          {onBack ? (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              disabled={isSubmitting || loading}
            >
              Back
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            {isSubmitting ? "Saving..." : "Continue to Step 5"}
          </Button>
        </div>
      </form>
    </div>
  );
}
