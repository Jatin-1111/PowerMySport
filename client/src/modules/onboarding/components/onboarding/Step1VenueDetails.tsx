"use client";

import { toast } from "@/lib/toast";
import { OnboardingStep2Payload } from "@/modules/onboarding/types/onboarding";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import OpeningHoursInput, { getDefaultOpeningHours } from "./OpeningHoursInput";

interface Step1VenueDetailsProps {
  onSubmit: (data: OnboardingStep2Payload) => Promise<void>;
  loading?: boolean;
}

interface PlaceSuggestion {
  label: string;
  lat: number;
  lon: number;
}

const DEBOUNCE_DELAY = 300;

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

export default function Step1VenueDetails({ onSubmit, loading }: Step1VenueDetailsProps) {
  const [formData, setFormData] = useState<OnboardingStep2Payload>({
    venueId: "",
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
      coordinates: [77.2, 28.7],
    },
  });

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [samePriceForAll, setSamePriceForAll] = useState(true);
  const [basePricePerHour, setBasePricePerHour] = useState(0);
  const [sportPricing, setSportPricing] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Fetch address suggestions from Google Places API via backend
  useEffect(() => {
    if (!addressInput.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setAutocompleteLoading(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(async () => {
      try {
        const response = await axios.get("/api/geo/autocomplete", {
          params: { q: addressInput },
        });

        if (response.data.success) {
          setSuggestions(response.data.data || []);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Autocomplete error:", err);
        setSuggestions([]);
      } finally {
        setAutocompleteLoading(false);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [addressInput]);

  const handleSuggestionSelect = (suggestion: PlaceSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.label,
      location: {
        type: "Point",
        coordinates: [suggestion.lon, suggestion.lat],
      },
    }));
    setAddressInput(suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
  };

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
    } else if (name === "lat" || name === "lng") {
      const coord = parseFloat(value) || 0;
      const newCoords: [number, number] = [
        name === "lng" ? coord : formData.location.coordinates[0],
        name === "lat" ? coord : formData.location.coordinates[1],
      ];
      setFormData((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          coordinates: newCoords,
        },
      }));
    } else if (name === "address") {
      setAddressInput(value);
      setFormData((prev) => ({
        ...prev,
        address: value,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
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
    if (!formData.name.trim()) {
      toast.error("Please enter venue name");
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
    if (!formData.address.trim()) {
      toast.error("Please enter venue address");
      return;
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
        pricePerHour: effectiveBasePrice,
        sportPricing: pricingMap,
      });
    } catch (err) {
      console.error("Form submission error:", err);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg bg-white p-6 shadow">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Add Your Venue</h1>
        <p className="mt-2 text-slate-600">Step 1 of 3: Basic Details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue Name */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Venue Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g., Central Sports Complex"
            className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Sports Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Sports Available <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {SPORTS_OPTIONS.map((sport) => (
              <label key={sport} className="flex cursor-pointer items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedSports.includes(sport)}
                  onChange={() => toggleSport(sport)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                <span className="text-sm text-slate-700">{sport}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="block text-sm font-medium text-slate-700">
              Pricing (per hour) <span className="text-red-500">*</span>
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
                className="h-4 w-4 rounded text-indigo-600"
              />
              Same price for all sports
            </label>
          </div>

          {samePriceForAll && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Base price per hour
                </label>
                <input
                  type="number"
                  value={basePricePerHour === 0 ? "" : basePricePerHour}
                  onChange={(e) => handleBasePriceChange(parseFloat(e.target.value) || 0)}
                  placeholder="500"
                  min="0"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  required
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
                  <label className="mb-2 block text-sm font-medium text-slate-700">
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
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opening Hours */}
        <OpeningHoursInput
          value={formData.openingHours}
          onChange={(hours) => setFormData((prev) => ({ ...prev, openingHours: hours }))}
        />

        {/* Address */}
        <div className="relative">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="address"
            value={addressInput}
            onChange={handleInputChange}
            placeholder="Search or type address..."
            className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            required
            onFocus={() => addressInput && setShowSuggestions(true)}
          />
          {autocompleteLoading && (
            <div className="absolute top-[2.4rem] right-3 text-slate-500">
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          )}

          {/* Address Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="w-full border-b border-slate-200 px-4 py-3 text-left transition last:border-b-0 hover:bg-indigo-50"
                >
                  <div className="text-sm font-medium text-slate-900">{suggestion.label}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {suggestion.lat.toFixed(4)}, {suggestion.lon.toFixed(4)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showSuggestions && addressInput && suggestions.length === 0 && !autocompleteLoading && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <p className="text-sm text-slate-600">No locations found</p>
            </div>
          )}
        </div>

        {/* Location Coordinates */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Location Coordinates
            <span className="ml-2 text-xs text-slate-500">(Auto-filled from Google Places)</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-slate-600">Longitude</label>
              <input
                type="number"
                name="lng"
                value={formData.location.coordinates[0]}
                onChange={handleInputChange}
                placeholder="77.2"
                step="0.0001"
                className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Latitude</label>
              <input
                type="number"
                name="lat"
                value={formData.location.coordinates[1]}
                onChange={handleInputChange}
                placeholder="28.7"
                step="0.0001"
                className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Tell players about your venue..."
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-200 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Amenities */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Amenities</label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {AMENITIES_OPTIONS.map((amenity) => (
              <label key={amenity} className="flex cursor-pointer items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                <span className="text-sm text-slate-700">{amenity}</span>
              </label>
            ))}
          </div>
        </div>

        {/* External Coaches */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="allowExternalCoaches"
            checked={formData.allowExternalCoaches}
            onChange={handleInputChange}
            className="h-4 w-4 rounded text-indigo-600"
          />
          <label className="text-sm text-slate-700">Allow external coaches at your venue?</label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating Venue..." : "Continue to Step 2: Upload Images"}
        </button>
      </form>
    </div>
  );
}
