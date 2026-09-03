"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import AmenitiesMultiSelect from "@/modules/shared/components/AmenitiesMultiSelect";
import type {
  AcademyCoachServiceMode,
  AcademyOwnedCoachInput,
  AcademyStep5Payload,
} from "@/modules/onboarding/types/academy";

interface Step5CoachesProps {
  academyId: string;
  onSubmit: (data: AcademyStep5Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep5Payload;
}

const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toCsv = (value?: string[]): string => (value || []).join(", ");

const parseLines = (value: string): string[] =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const toLines = (value?: string[]): string => (value || []).join("\n");

const createEmptyCoach = (): AcademyOwnedCoachInput => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "+91",
  bio: "",
  profilePhotoUrl: "",
  profilePhotoKey: "",
  sports: [],
  hourlyRate: 0,
  sportPricing: {},
  serviceMode: "FREELANCE",
  baseLocation: undefined,
  serviceRadiusKm: 10,
  travelBufferTime: 30,
  ownVenueDetails: undefined,
  certifications: [],
});

export default function Step5Coaches({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step5CoachesProps) {
  const [coaches, setCoaches] = useState<AcademyOwnedCoachInput[]>(
    previousData?.academyCoaches?.length ? previousData.academyCoaches : [createEmptyCoach()]
  );
  const [baseLocationQueries, setBaseLocationQueries] = useState<string[]>(
    previousData?.academyCoaches?.length ? previousData.academyCoaches.map(() => "") : [""]
  );
  const [ownVenueAddressQueries, setOwnVenueAddressQueries] = useState<string[]>(
    previousData?.academyCoaches?.length
      ? previousData.academyCoaches.map((coach) => coach.ownVenueDetails?.address || "")
      : [""]
  );

  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [activeTarget, setActiveTarget] = useState<{
    index: number;
    type: "base" | "ownVenue";
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const skipAutocompleteRef = useRef(false);

  useEffect(() => {
    if (!activeTarget) {
      setSuggestions([]);
      return;
    }

    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const query =
      activeTarget.type === "base"
        ? baseLocationQueries[activeTarget.index] || ""
        : ownVenueAddressQueries[activeTarget.index] || "";

    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await geoApi.autocomplete(query.trim());
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [activeTarget, baseLocationQueries, ownVenueAddressQueries]);

  const updateCoach = (
    index: number,
    updater: (coach: AcademyOwnedCoachInput) => AcademyOwnedCoachInput
  ) => {
    setCoaches((prev) =>
      prev.map((coach, currentIndex) => (currentIndex === index ? updater(coach) : coach))
    );
  };

  const addCoach = () => {
    setCoaches((prev) => [...prev, createEmptyCoach()]);
    setBaseLocationQueries((prev) => [...prev, ""]);
    setOwnVenueAddressQueries((prev) => [...prev, ""]);
  };

  const removeCoach = (index: number) => {
    setCoaches((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setBaseLocationQueries((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setOwnVenueAddressQueries((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    if (activeTarget?.index === index) {
      setActiveTarget(null);
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: GeoSuggestion) => {
    if (!activeTarget) return;

    skipAutocompleteRef.current = true;

    if (activeTarget.type === "base") {
      setBaseLocationQueries((prev) =>
        prev.map((query, index) => (index === activeTarget.index ? suggestion.label : query))
      );
      updateCoach(activeTarget.index, (coach) => ({
        ...coach,
        baseLocation: {
          type: "Point",
          coordinates: [suggestion.lon, suggestion.lat],
        },
      }));
    } else {
      setOwnVenueAddressQueries((prev) =>
        prev.map((query, index) => (index === activeTarget.index ? suggestion.label : query))
      );
      updateCoach(activeTarget.index, (coach) => ({
        ...coach,
        ownVenueDetails: {
          name: coach.ownVenueDetails?.name || "",
          address: suggestion.label,
          description: coach.ownVenueDetails?.description || "",
          openingHours: coach.ownVenueDetails?.openingHours || "",
          amenities: coach.ownVenueDetails?.amenities || [],
          images: coach.ownVenueDetails?.images || [],
          imageS3Keys: coach.ownVenueDetails?.imageS3Keys || [],
          location: {
            type: "Point",
            coordinates: [suggestion.lon, suggestion.lat],
          },
        },
      }));
    }

    setSuggestions([]);
    setActiveTarget(null);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!coaches.length) {
      errors.coaches = "Add at least one coach";
    }

    coaches.forEach((coach, index) => {
      const key = `coach_${index}`;
      if (coach.firstName.trim().length < 2) {
        errors[`${key}_firstName`] = "First name is required";
      }
      if (coach.lastName.trim().length < 2) {
        errors[`${key}_lastName`] = "Last name is required";
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coach.email.trim())) {
        errors[`${key}_email`] = "Valid email is required";
      }
      if (!/^[+]?[0-9\s().-]{10,16}$/.test(coach.phone.trim())) {
        errors[`${key}_phone`] = "Valid phone is required";
      }
      if (coach.bio.trim().length < 20) {
        errors[`${key}_bio`] = "Bio must be at least 20 characters";
      }
      if (!coach.sports.length) {
        errors[`${key}_sports`] = "Select at least one sport";
      }
      if (!coach.hourlyRate || coach.hourlyRate < 100) {
        errors[`${key}_hourlyRate`] = "Hourly rate must be at least Rs 1";
      }
      if (coach.serviceMode !== "OWN_VENUE" && !coach.baseLocation) {
        errors[`${key}_baseLocation`] = "Base location is required for this service mode";
      }
      if (coach.serviceMode !== "OWN_VENUE") {
        if (!coach.serviceRadiusKm || coach.serviceRadiusKm <= 0) {
          errors[`${key}_serviceRadiusKm`] = "Service radius must be greater than 0";
        }
        if (
          coach.travelBufferTime === undefined ||
          coach.travelBufferTime === null ||
          coach.travelBufferTime < 0
        ) {
          errors[`${key}_travelBufferTime`] = "Travel buffer time must be non-negative";
        }
      }
      if (coach.serviceMode !== "FREELANCE") {
        if (!coach.ownVenueDetails?.name?.trim()) {
          errors[`${key}_ownVenueName`] = "Own venue name is required";
        }
        if (!coach.ownVenueDetails?.address?.trim()) {
          errors[`${key}_ownVenueAddress`] = "Own venue address is required";
        }
        if ((coach.ownVenueDetails?.images || []).length < 3) {
          errors[`${key}_ownVenueImages`] = "Add at least 3 own-venue image URLs";
        }
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) {
      toast.error("Please fix coach details before continuing");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        academyId,
        academyCoaches: coaches,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save coaches");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-slate-900">Step 5: Coach Details</h2>
        <p className="text-slate-600">
          Add full coach onboarding details, including sports, pricing, service mode, maps location,
          and images.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">In-house Coaches</h3>
          <Button
            type="button"
            variant="outline"
            onClick={addCoach}
            disabled={isSubmitting || loading}
          >
            Add Coach
          </Button>
        </div>

        {fieldErrors.coaches ? <p className="text-xs text-red-600">{fieldErrors.coaches}</p> : null}

        {coaches.map((coach, index) => (
          <div
            key={`academy-coach-${index}`}
            className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">Coach {index + 1}</h4>
              <button
                type="button"
                className="text-sm text-red-600 disabled:text-slate-400"
                onClick={() => removeCoach(index)}
                disabled={coaches.length === 1 || isSubmitting || loading}
              >
                Remove
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="text"
                value={coach.firstName}
                onChange={(e) =>
                  updateCoach(index, (c) => ({
                    ...c,
                    firstName: e.target.value,
                  }))
                }
                placeholder="First name"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <input
                type="text"
                value={coach.lastName}
                onChange={(e) =>
                  updateCoach(index, (c) => ({
                    ...c,
                    lastName: e.target.value,
                  }))
                }
                placeholder="Last name"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <input
                type="email"
                value={coach.email}
                onChange={(e) => updateCoach(index, (c) => ({ ...c, email: e.target.value }))}
                placeholder="Email"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <input
                type="text"
                value={coach.phone}
                onChange={(e) => updateCoach(index, (c) => ({ ...c, phone: e.target.value }))}
                placeholder="Phone"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <input
                type="url"
                value={coach.profilePhotoUrl || ""}
                onChange={(e) =>
                  updateCoach(index, (c) => ({
                    ...c,
                    profilePhotoUrl: e.target.value,
                  }))
                }
                placeholder="Profile photo URL"
                className="rounded-lg border border-slate-300 px-3 py-2 md:col-span-2"
                disabled={isSubmitting || loading}
              />
            </div>

            <textarea
              value={coach.bio}
              onChange={(e) => updateCoach(index, (c) => ({ ...c, bio: e.target.value }))}
              placeholder="Coach bio"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              disabled={isSubmitting || loading}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">Sports *</label>
              <SportsMultiSelect
                value={coach.sports}
                onChange={(sports) =>
                  updateCoach(index, (c) => ({
                    ...c,
                    sports,
                    sportPricing: Object.fromEntries(
                      sports.map((sport) => [sport, c.sportPricing?.[sport] || c.hourlyRate || 0])
                    ),
                  }))
                }
                disabled={isSubmitting || loading}
                required
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                min={1}
                value={coach.hourlyRate ? coach.hourlyRate / 100 : ""}
                onChange={(e) =>
                  updateCoach(index, (c) => ({
                    ...c,
                    hourlyRate: Math.round(Number(e.target.value || 0) * 100),
                  }))
                }
                placeholder="Hourly rate"
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
              <select
                value={coach.serviceMode}
                onChange={(e) =>
                  updateCoach(index, (c) => ({
                    ...c,
                    serviceMode: e.target.value as AcademyCoachServiceMode,
                    ownVenueDetails:
                      e.target.value === "FREELANCE"
                        ? undefined
                        : c.ownVenueDetails || {
                            name: "",
                            address: "",
                            description: "",
                            openingHours: "",
                            amenities: [],
                            images: [],
                            imageS3Keys: [],
                          },
                  }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              >
                <option value="OWN_VENUE">Own venue</option>
                <option value="FREELANCE">Freelance</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Certifications (comma separated)
              </label>
              <input
                type="text"
                value={toCsv(coach.certifications)}
                onChange={(e) =>
                  updateCoach(index, (c) => ({
                    ...c,
                    certifications: parseCsv(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                disabled={isSubmitting || loading}
              />
            </div>

            {coach.serviceMode !== "OWN_VENUE" ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-900">
                  Base location (Google Maps API)
                </p>
                <input
                  type="text"
                  value={baseLocationQueries[index] || ""}
                  onFocus={() => setActiveTarget({ index, type: "base" })}
                  onChange={(e) => {
                    setBaseLocationQueries((prev) =>
                      prev.map((query, currentIndex) =>
                        currentIndex === index ? e.target.value : query
                      )
                    );
                    updateCoach(index, (c) => ({
                      ...c,
                      baseLocation: undefined,
                    }));
                    setActiveTarget({ index, type: "base" });
                  }}
                  placeholder="Search base location"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={isSubmitting || loading}
                />
                {activeTarget?.index === index && activeTarget.type === "base" && isSearching ? (
                  <p className="text-xs text-slate-500">Searching location...</p>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="number"
                    min={1}
                    value={coach.serviceRadiusKm || ""}
                    onChange={(e) =>
                      updateCoach(index, (c) => ({
                        ...c,
                        serviceRadiusKm: Number(e.target.value || 0),
                      }))
                    }
                    placeholder="Service radius (km)"
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    disabled={isSubmitting || loading}
                  />
                  <input
                    type="number"
                    min={0}
                    value={coach.travelBufferTime || ""}
                    onChange={(e) =>
                      updateCoach(index, (c) => ({
                        ...c,
                        travelBufferTime: Number(e.target.value || 0),
                      }))
                    }
                    placeholder="Travel buffer (minutes)"
                    className="rounded-lg border border-slate-300 px-3 py-2"
                    disabled={isSubmitting || loading}
                  />
                </div>
              </div>
            ) : null}

            {coach.serviceMode !== "FREELANCE" ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm font-medium text-slate-900">Own venue details</p>
                <input
                  type="text"
                  value={coach.ownVenueDetails?.name || ""}
                  onChange={(e) =>
                    updateCoach(index, (c) => ({
                      ...c,
                      ownVenueDetails: {
                        name: e.target.value,
                        address: c.ownVenueDetails?.address || "",
                        description: c.ownVenueDetails?.description || "",
                        openingHours: c.ownVenueDetails?.openingHours || "",
                        amenities: c.ownVenueDetails?.amenities || [],
                        images: c.ownVenueDetails?.images || [],
                        imageS3Keys: c.ownVenueDetails?.imageS3Keys || [],
                        location: c.ownVenueDetails?.location,
                      },
                    }))
                  }
                  placeholder="Own venue name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={isSubmitting || loading}
                />
                <input
                  type="text"
                  value={ownVenueAddressQueries[index] || ""}
                  onFocus={() => setActiveTarget({ index, type: "ownVenue" })}
                  onChange={(e) => {
                    setOwnVenueAddressQueries((prev) =>
                      prev.map((query, currentIndex) =>
                        currentIndex === index ? e.target.value : query
                      )
                    );
                    updateCoach(index, (c) => ({
                      ...c,
                      ownVenueDetails: {
                        name: c.ownVenueDetails?.name || "",
                        address: e.target.value,
                        description: c.ownVenueDetails?.description || "",
                        openingHours: c.ownVenueDetails?.openingHours || "",
                        amenities: c.ownVenueDetails?.amenities || [],
                        images: c.ownVenueDetails?.images || [],
                        imageS3Keys: c.ownVenueDetails?.imageS3Keys || [],
                      },
                    }));
                    setActiveTarget({ index, type: "ownVenue" });
                  }}
                  placeholder="Search own venue address"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={isSubmitting || loading}
                />
                <textarea
                  value={coach.ownVenueDetails?.description || ""}
                  onChange={(e) =>
                    updateCoach(index, (c) => ({
                      ...c,
                      ownVenueDetails: {
                        name: c.ownVenueDetails?.name || "",
                        address: c.ownVenueDetails?.address || "",
                        description: e.target.value,
                        openingHours: c.ownVenueDetails?.openingHours || "",
                        amenities: c.ownVenueDetails?.amenities || [],
                        images: c.ownVenueDetails?.images || [],
                        imageS3Keys: c.ownVenueDetails?.imageS3Keys || [],
                        location: c.ownVenueDetails?.location,
                      },
                    }))
                  }
                  rows={2}
                  placeholder="Own venue description"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={isSubmitting || loading}
                />
                <input
                  type="text"
                  value={coach.ownVenueDetails?.openingHours || ""}
                  onChange={(e) =>
                    updateCoach(index, (c) => ({
                      ...c,
                      ownVenueDetails: {
                        name: c.ownVenueDetails?.name || "",
                        address: c.ownVenueDetails?.address || "",
                        description: c.ownVenueDetails?.description || "",
                        openingHours: e.target.value,
                        amenities: c.ownVenueDetails?.amenities || [],
                        images: c.ownVenueDetails?.images || [],
                        imageS3Keys: c.ownVenueDetails?.imageS3Keys || [],
                        location: c.ownVenueDetails?.location,
                      },
                    }))
                  }
                  placeholder="Opening hours summary"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={isSubmitting || loading}
                />
                <AmenitiesMultiSelect
                  value={coach.ownVenueDetails?.amenities || []}
                  onChange={(amenities) =>
                    updateCoach(index, (c) => ({
                      ...c,
                      ownVenueDetails: {
                        name: c.ownVenueDetails?.name || "",
                        address: c.ownVenueDetails?.address || "",
                        description: c.ownVenueDetails?.description || "",
                        openingHours: c.ownVenueDetails?.openingHours || "",
                        amenities,
                        images: c.ownVenueDetails?.images || [],
                        imageS3Keys: c.ownVenueDetails?.imageS3Keys || [],
                        location: c.ownVenueDetails?.location,
                      },
                    }))
                  }
                  disabled={isSubmitting || loading}
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Own venue image URLs (one per line, min 3)
                  </label>
                  <textarea
                    rows={3}
                    value={toLines(coach.ownVenueDetails?.images || [])}
                    onChange={(e) =>
                      updateCoach(index, (c) => ({
                        ...c,
                        ownVenueDetails: {
                          name: c.ownVenueDetails?.name || "",
                          address: c.ownVenueDetails?.address || "",
                          description: c.ownVenueDetails?.description || "",
                          openingHours: c.ownVenueDetails?.openingHours || "",
                          amenities: c.ownVenueDetails?.amenities || [],
                          images: parseLines(e.target.value),
                          imageS3Keys: c.ownVenueDetails?.imageS3Keys || [],
                          location: c.ownVenueDetails?.location,
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    disabled={isSubmitting || loading}
                  />
                </div>
              </div>
            ) : null}

            {fieldErrors[`coach_${index}_firstName`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_firstName`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_lastName`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_lastName`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_email`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_email`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_phone`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_phone`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_bio`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_bio`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_sports`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_sports`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_hourlyRate`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_hourlyRate`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_baseLocation`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_baseLocation`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_serviceRadiusKm`] ? (
              <p className="text-xs text-red-600">
                {fieldErrors[`coach_${index}_serviceRadiusKm`]}
              </p>
            ) : null}
            {fieldErrors[`coach_${index}_travelBufferTime`] ? (
              <p className="text-xs text-red-600">
                {fieldErrors[`coach_${index}_travelBufferTime`]}
              </p>
            ) : null}
            {fieldErrors[`coach_${index}_ownVenueName`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_ownVenueName`]}</p>
            ) : null}
            {fieldErrors[`coach_${index}_ownVenueAddress`] ? (
              <p className="text-xs text-red-600">
                {fieldErrors[`coach_${index}_ownVenueAddress`]}
              </p>
            ) : null}
            {fieldErrors[`coach_${index}_ownVenueImages`] ? (
              <p className="text-xs text-red-600">{fieldErrors[`coach_${index}_ownVenueImages`]}</p>
            ) : null}
          </div>
        ))}

        {activeTarget && suggestions.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="mb-2 text-xs text-slate-500">Location suggestions</p>
            <div className="max-h-44 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="block w-full border-b border-slate-100 px-2 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
          <Button type="submit" disabled={isSubmitting || loading} className="flex-1">
            {isSubmitting ? "Saving..." : "Continue to Step 6"}
          </Button>
        </div>
      </form>
    </div>
  );
}
