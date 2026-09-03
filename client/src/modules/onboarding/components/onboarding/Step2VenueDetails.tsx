"use client";

import { toast } from "@/lib/toast";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";
import { OnboardingStep2Payload } from "@/modules/onboarding/types/onboarding";
import { Button } from "@/modules/shared/ui/Button";
import { useEffect, useRef, useState } from "react";
import OnboardingSectionCard from "./OnboardingSectionCard";
import OpeningHoursInput, { getDefaultOpeningHours } from "./OpeningHoursInput";

interface Step2VenueDetailsProps {
  venueId: string;
  onSubmit: (data: OnboardingStep2Payload) => Promise<void>;
  loading?: boolean;
  onSkip?: (hasCoaches?: boolean) => Promise<void>;
}

const SPORTS_OPTIONS = [
  "Badminton",
  "Cricket",
  "Football",
  "Basketball",
  "Tennis",
  "Volleyball",
  "Squash",
  "Table Tennis",
  "Gym",
  "Swimming",
];

const AMENITIES_OPTIONS = [
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

const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

const isValidTimeRange = (openTime?: string, closeTime?: string): boolean => {
  if (!openTime || !closeTime) {
    return false;
  }

  return openTime < closeTime;
};

export default function Step2VenueDetails({
  venueId,
  onSubmit,
  loading,
  onSkip,
}: Step2VenueDetailsProps) {
  const [formData, setFormData] = useState<OnboardingStep2Payload>({
    venueId,
    name: "",
    sports: [],
    pricePerHour: 0,
    sportPricing: {},
    amenities: [],
    address: "",
    openingHours: getDefaultOpeningHours(),
    description: "",
    allowExternalCoaches: true,
    hasCoaches: false,
    location: {
      type: "Point",
      coordinates: [77.2, 28.7], // Default Delhi coordinates
    },
  });

  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const skipAutocompleteRef = useRef(false);

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [samePriceForAll, setSamePriceForAll] = useState(true);
  const [basePricePerHour, setBasePricePerHour] = useState(0);
  const [sportPricing, setSportPricing] = useState<Record<string, number>>({});

  useEffect(() => {
    setAddressQuery(formData.address);
  }, [formData.address]);

  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }

    const query = addressQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setSearchError("");
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setSearchError("");
      try {
        const results = await geoApi.autocomplete(query);
        setSuggestions(results);
      } catch (err) {
        setSearchError("Unable to fetch suggestions");
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [addressQuery]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    skipAutocompleteRef.current = false;
    setAddressQuery(value);
    setHasSelectedLocation(false);
    setFormData((prev) => ({
      ...prev,
      address: value,
    }));
  };

  const handleSelectSuggestion = (suggestion: GeoSuggestion) => {
    skipAutocompleteRef.current = true;
    setHasSelectedLocation(true);
    setSuggestions([]);
    setSearchError("");
    setAddressQuery(suggestion.label);
    setFormData((prev) => ({
      ...prev,
      address: suggestion.label,
      location: {
        ...prev.location,
        coordinates: [suggestion.lon, suggestion.lat],
      },
    }));
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setSearchError("Geolocation is not supported by this browser");
      return;
    }

    setIsGeocoding(true);
    setSearchError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await geoApi.reverse(latitude, longitude);
          if (!result) {
            setSearchError("Unable to find address for this location");
            return;
          }

          skipAutocompleteRef.current = true;
          setHasSelectedLocation(true);
          setSuggestions([]);
          setAddressQuery(result.label);
          setFormData((prev) => ({
            ...prev,
            address: result.label,
            location: {
              ...prev.location,
              coordinates: [result.lon, result.lat],
            },
          }));
        } catch (err) {
          setSearchError("Unable to resolve current location");
        } finally {
          setIsGeocoding(false);
        }
      },
      () => {
        setSearchError("Location access was denied");
        setIsGeocoding(false);
      }
    );
  };

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) => {
      const updated = prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport];
      setFormData((prev) => ({
        ...prev,
        sports: updated,
      }));
      setSportPricing((prevPricing) => {
        const nextPricing: Record<string, number> = {};
        updated.forEach((item) => {
          if (item === sport && !prev.includes(sport)) {
            nextPricing[item] = samePriceForAll ? basePricePerHour : 0;
          } else {
            nextPricing[item] = prevPricing[item] ?? 0;
          }
        });
        return nextPricing;
      });
      return updated;
    });
  };

  const handleBasePriceChange = (value: number) => {
    setBasePricePerHour(value);
    if (samePriceForAll) {
      setSportPricing(() => {
        const nextPricing: Record<string, number> = {};
        formData.sports.forEach((sport) => {
          nextPricing[sport] = value;
        });
        return nextPricing;
      });
    }
  };

  const handleSportPriceChange = (sport: string, value: number) => {
    setSportPricing((prev) => ({
      ...prev,
      [sport]: value,
    }));
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) => {
      const updated = prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity];
      setFormData((prev) => ({
        ...prev,
        amenities: updated,
      }));
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const trimmedName = formData.name.trim();
    if (trimmedName.length < 2) {
      toast.error("Please enter a venue name with at least 2 characters");
      return;
    }
    if (formData.sports.length === 0) {
      toast.error("Please select at least one sport");
      return;
    }
    if (samePriceForAll) {
      if (basePricePerHour <= 0) {
        toast.error("Please enter valid price per hour");
        return;
      }
    } else {
      const invalidSport = formData.sports.find((sport) => (sportPricing[sport] || 0) <= 0);
      if (invalidSport) {
        toast.error(`Please enter a valid price for ${invalidSport}`);
        return;
      }
    }

    const trimmedAddress = formData.address.trim();
    if (trimmedAddress.length < 5) {
      toast.error("Please enter a venue address with at least 5 characters");
      return;
    }

    if (formData.description.trim().length > 500) {
      toast.error("Description cannot exceed 500 characters");
      return;
    }

    const openDays = Object.entries(formData.openingHours).filter(([, hours]) => hours.isOpen);
    if (openDays.length === 0) {
      toast.error("Please set opening hours for at least one day");
      return;
    }

    const invalidDay = openDays.find(
      ([, hours]) => !isValidTimeRange(hours.openTime, hours.closeTime)
    );
    if (invalidDay) {
      toast.error("Opening time must be before closing time for open days");
      return;
    }

    if (!hasSelectedLocation) {
      setIsGeocoding(true);
      setSearchError("");
      try {
        const result = await geoApi.geocode(formData.address);
        if (!result) {
          toast.error("Address not found. Please pick a suggestion.");
          return;
        }

        setHasSelectedLocation(true);
        setAddressQuery(result.label);
        setFormData((prev) => ({
          ...prev,
          address: result.label,
          location: {
            ...prev.location,
            coordinates: [result.lon, result.lat],
          },
        }));
      } catch (err) {
        toast.error("Unable to verify address. Please try again.");
        return;
      } finally {
        setIsGeocoding(false);
      }
    }

    try {
      const pricingMap = samePriceForAll
        ? Object.fromEntries(formData.sports.map((sport) => [sport, basePricePerHour]))
        : formData.sports.reduce<Record<string, number>>((acc, sport) => {
            acc[sport] = sportPricing[sport] || 0;
            return acc;
          }, {});

      const effectiveBasePrice = samePriceForAll
        ? basePricePerHour
        : Math.min(...Object.values(pricingMap));

      await onSubmit({
        ...formData,
        name: trimmedName,
        address: trimmedAddress,
        description: formData.description.trim(),
        pricePerHour: effectiveBasePrice,
        sportPricing: pricingMap,
      });
    } catch (err) {
      console.error("Form submission error:", err);
    }
  };

  return (
    <div className="shadow-xs space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Tell us about your venue</h1>
        <p className="text-slate-600">Step 2 of 4: Venue Details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue Name */}
        <OnboardingSectionCard
          title="Venue Name"
          subtitle="Give your facility a clear, recognizable name"
        >
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Venue Name <span className="text-error-red">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g., Central Sports Complex"
            className="focus:ring-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-offset-1"
            required
            disabled={loading}
          />
        </OnboardingSectionCard>

        {/* Sports Selection */}
        <OnboardingSectionCard
          title="Sports Available"
          subtitle="Choose all sports your venue supports"
        >
          <label className="mb-3 block text-sm font-semibold text-slate-900">
            Sports Available <span className="text-error-red">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {SPORTS_OPTIONS.map((sport) => (
              <label
                key={sport}
                className="hover:bg-power-orange/5 flex cursor-pointer items-center space-x-2 rounded-lg border border-slate-200 p-3 transition"
              >
                <input
                  type="checkbox"
                  checked={selectedSports.includes(sport)}
                  onChange={() => toggleSport(sport)}
                  className="accent-power-orange h-4 w-4 rounded"
                  disabled={loading}
                />
                <span className="text-sm text-slate-700">{sport}</span>
              </label>
            ))}
          </div>
        </OnboardingSectionCard>

        {/* Pricing */}
        <OnboardingSectionCard
          title="Pricing"
          subtitle="Set hourly rates for each sport"
          contentClassName="space-y-4"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="block text-sm font-semibold text-slate-900">
              Pricing (per hour) <span className="text-error-red">*</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={samePriceForAll}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSamePriceForAll(checked);
                  if (checked) {
                    const nextPricing: Record<string, number> = {};
                    formData.sports.forEach((sport) => {
                      nextPricing[sport] = basePricePerHour;
                    });
                    setSportPricing(nextPricing);
                  }
                }}
                className="accent-power-orange h-4 w-4 rounded"
                disabled={loading}
              />
              Same price for all sports
            </label>
          </div>

          {samePriceForAll && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Base price per hour
                </label>
                <input
                  type="number"
                  value={basePricePerHour === 0 ? "" : basePricePerHour}
                  onChange={(e) => handleBasePriceChange(parseFloat(e.target.value) || 0)}
                  placeholder="500"
                  min="0"
                  className="focus:ring-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-offset-1"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {formData.sports.length === 0 && (
            <p className="text-sm text-slate-500">Select sports to set specific prices.</p>
          )}

          {!samePriceForAll && formData.sports.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {formData.sports.map((sport) => (
                <div key={sport}>
                  <label className="mb-2 block text-sm font-semibold text-slate-900">
                    {sport} price per hour
                  </label>
                  <input
                    type="number"
                    value={
                      sportPricing[sport] === 0 || !sportPricing[sport] ? "" : sportPricing[sport]
                    }
                    onChange={(e) => handleSportPriceChange(sport, parseFloat(e.target.value) || 0)}
                    placeholder="500"
                    min="0"
                    className="focus:ring-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-offset-1"
                    required
                    disabled={loading}
                  />
                </div>
              ))}
            </div>
          )}
        </OnboardingSectionCard>

        {/* Opening Hours */}
        <OnboardingSectionCard
          title="Opening Hours"
          subtitle="Set weekly operating schedule for your venue"
        >
          <OpeningHoursInput
            value={formData.openingHours}
            onChange={(hours) => setFormData((prev) => ({ ...prev, openingHours: hours }))}
          />
        </OnboardingSectionCard>

        {/* Address */}
        <OnboardingSectionCard
          title="Venue Address"
          subtitle="Use search suggestions or current location for accurate mapping"
        >
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Address <span className="text-error-red">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              name="address"
              value={addressQuery}
              onChange={handleAddressChange}
              placeholder="Search your venue location"
              className="focus:ring-power-orange w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-offset-1"
              required
              disabled={loading}
            />
            {isSearching && (
              <span className="absolute right-3 top-2.5 text-xs text-slate-500">Searching...</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-slate-500">Start typing to see suggestions</p>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="text-power-orange text-xs font-semibold hover:text-orange-600"
              disabled={loading || isGeocoding}
            >
              {isGeocoding ? "Locating..." : "Use current location"}
            </button>
          </div>
          {searchError && <p className="text-error-red mt-2 text-xs">{searchError}</p>}
          {suggestions.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={`${suggestion.lat}-${suggestion.lon}-${suggestion.label}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="hover:bg-power-orange/5 w-full px-3 py-2 text-left text-sm text-slate-700"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </OnboardingSectionCard>

        {/* Description */}
        <OnboardingSectionCard
          title="Description"
          subtitle="Help players understand your venue experience"
        >
          <label className="mb-2 block text-sm font-semibold text-slate-900">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Tell players about your venue..."
            rows={4}
            className="focus:ring-power-orange w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder-slate-500 transition focus:outline-none focus:ring-2 focus:ring-offset-1"
            disabled={loading}
          />
        </OnboardingSectionCard>

        {/* Amenities */}
        <OnboardingSectionCard
          title="Amenities"
          subtitle="Select facilities available for your customers"
        >
          <label className="mb-3 block text-sm font-semibold text-slate-900">Amenities</label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {AMENITIES_OPTIONS.map((amenity) => (
              <label
                key={amenity}
                className="hover:bg-power-orange/5 flex cursor-pointer items-center space-x-2 rounded-lg border border-slate-200 p-3 transition"
              >
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="accent-power-orange h-4 w-4 rounded"
                  disabled={loading}
                />
                <span className="text-sm text-slate-700">{amenity}</span>
              </label>
            ))}
          </div>
        </OnboardingSectionCard>

        {/* External Coaches */}
        <OnboardingSectionCard
          title="Coach Preferences"
          subtitle="Configure external and in-house coach settings"
        >
          <div className="bg-power-orange/5 border-power-orange/20 flex items-center space-x-2 rounded-lg border p-4">
            <input
              type="checkbox"
              name="allowExternalCoaches"
              checked={formData.allowExternalCoaches}
              onChange={handleInputChange}
              className="accent-power-orange h-4 w-4 rounded"
              disabled={loading}
            />
            <label className="text-sm text-slate-700">Allow external coaches at your venue?</label>
          </div>

          <div className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <input
              type="checkbox"
              name="hasCoaches"
              checked={formData.hasCoaches}
              onChange={handleInputChange}
              className="accent-power-orange h-4 w-4 rounded"
              disabled={loading}
            />
            <label className="text-sm text-slate-700">
              Do you have in-house coaches? (Add them in the next step)
            </label>
          </div>
        </OnboardingSectionCard>

        {/* Submit Button */}
        <Button
          type="submit"
          className="bg-power-orange w-full py-2.5 text-base text-white hover:bg-orange-600"
          disabled={loading}
        >
          {loading ? "Saving Details..." : "Continue to Step 3: Upload Images & Documents"}
        </Button>
        {isDev && onSkip && (
          <Button
            type="button"
            onClick={() => onSkip && onSkip(formData.hasCoaches)}
            disabled={loading}
            className="w-full bg-slate-600 py-2.5 text-base text-white hover:bg-slate-700"
          >
            Skip (Dev)
          </Button>
        )}
      </form>
    </div>
  );
}
