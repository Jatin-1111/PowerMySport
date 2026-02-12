"use client";

import { useEffect, useState } from "react";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { OnboardingStep2Payload } from "@/modules/onboarding/types/onboarding";
import { geoApi, GeoSuggestion } from "@/modules/geo/services/geo";

interface Step2VenueDetailsProps {
  venueId: string;
  onSubmit: (data: OnboardingStep2Payload) => Promise<void>;
  loading?: boolean;
  error?: string;
  onSkip?: () => Promise<void>;
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

const isDev =
  typeof window !== "undefined" && process.env.NODE_ENV === "development";

export default function Step2VenueDetails({
  venueId,
  onSubmit,
  loading,
  error,
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
    openingHours: "9:00 AM - 9:00 PM",
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

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [samePriceForAll, setSamePriceForAll] = useState(true);
  const [basePricePerHour, setBasePricePerHour] = useState(0);
  const [sportPricing, setSportPricing] = useState<Record<string, number>>({});

  useEffect(() => {
    setAddressQuery(formData.address);
  }, [formData.address]);

  useEffect(() => {
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
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
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
    setAddressQuery(value);
    setHasSelectedLocation(false);
    setFormData((prev) => ({
      ...prev,
      address: value,
    }));
  };

  const handleSelectSuggestion = (suggestion: GeoSuggestion) => {
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
      },
    );
  };

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) => {
      const updated = prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport];
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
      setSportPricing((prev) => {
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
      alert("Please enter venue name");
      return;
    }
    if (formData.sports.length === 0) {
      alert("Please select at least one sport");
      return;
    }
    if (samePriceForAll) {
      if (basePricePerHour <= 0) {
        alert("Please enter valid price per hour");
        return;
      }
    } else {
      const invalidSport = formData.sports.find(
        (sport) => (sportPricing[sport] || 0) <= 0,
      );
      if (invalidSport) {
        alert(`Please enter a valid price for ${invalidSport}`);
        return;
      }
    }
    if (!formData.address.trim()) {
      alert("Please enter venue address");
      return;
    }

    if (!hasSelectedLocation) {
      setIsGeocoding(true);
      setSearchError("");
      try {
        const result = await geoApi.geocode(formData.address);
        if (!result) {
          alert("We couldn't find this address. Please pick a suggestion.");
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
        alert("Unable to verify address right now. Please try again.");
        return;
      } finally {
        setIsGeocoding(false);
      }
    }

    try {
      const pricingMap = samePriceForAll
        ? Object.fromEntries(
            formData.sports.map((sport) => [sport, basePricePerHour]),
          )
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
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Tell us about your venue
        </h1>
        <p className="text-slate-600">Step 2 of 4: Venue Details</p>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <p className="text-error-red font-medium">{error}</p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Venue Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Venue Name <span className="text-error-red">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="e.g., Central Sports Complex"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition bg-white text-slate-900 placeholder-slate-500"
            required
            disabled={loading}
          />
        </div>

        {/* Sports Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Sports Available <span className="text-error-red">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SPORTS_OPTIONS.map((sport) => (
              <label
                key={sport}
                className="flex items-center space-x-2 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-power-orange/5 transition"
              >
                <input
                  type="checkbox"
                  checked={selectedSports.includes(sport)}
                  onChange={() => toggleSport(sport)}
                  className="w-4 h-4 accent-power-orange rounded"
                  disabled={loading}
                />
                <span className="text-sm text-slate-700">{sport}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-4">
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
                className="w-4 h-4 accent-power-orange rounded"
                disabled={loading}
              />
              Same price for all sports
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Base price per hour
              </label>
              <input
                type="number"
                value={basePricePerHour}
                onChange={(e) =>
                  handleBasePriceChange(parseFloat(e.target.value) || 0)
                }
                placeholder="500"
                min="0"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition bg-white text-slate-900 placeholder-slate-500"
                required
                disabled={loading}
              />
            </div>
          </div>

          {formData.sports.length === 0 && (
            <p className="text-sm text-slate-500">
              Select sports to set specific prices.
            </p>
          )}

          {!samePriceForAll && formData.sports.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.sports.map((sport) => (
                <div key={sport}>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    {sport} price per hour
                  </label>
                  <input
                    type="number"
                    value={sportPricing[sport] ?? ""}
                    onChange={(e) =>
                      handleSportPriceChange(
                        sport,
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    placeholder="500"
                    min="0"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition bg-white text-slate-900 placeholder-slate-500"
                    required
                    disabled={loading}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opening Hours */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Opening Hours
          </label>
          <input
            type="text"
            name="openingHours"
            value={formData.openingHours}
            onChange={handleInputChange}
            placeholder="9:00 AM - 9:00 PM"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition bg-white text-slate-900 placeholder-slate-500"
            disabled={loading}
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Address <span className="text-error-red">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              name="address"
              value={addressQuery}
              onChange={handleAddressChange}
              placeholder="Search your venue location"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition bg-white text-slate-900 placeholder-slate-500"
              required
              disabled={loading}
            />
            {isSearching && (
              <span className="absolute right-3 top-2.5 text-xs text-slate-500">
                Searching...
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-500">
              Start typing to see suggestions
            </p>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="text-xs font-semibold text-power-orange hover:text-orange-600"
              disabled={loading || isGeocoding}
            >
              {isGeocoding ? "Locating..." : "Use current location"}
            </button>
          </div>
          {searchError && (
            <p className="text-xs text-error-red mt-2">{searchError}</p>
          )}
          {suggestions.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={`${suggestion.lat}-${suggestion.lon}-${suggestion.label}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-power-orange/5"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Tell players about your venue..."
            rows={4}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange focus:ring-offset-1 transition bg-white text-slate-900 placeholder-slate-500 resize-none"
            disabled={loading}
          />
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Amenities
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AMENITIES_OPTIONS.map((amenity) => (
              <label
                key={amenity}
                className="flex items-center space-x-2 cursor-pointer p-3 border border-slate-200 rounded-lg hover:bg-power-orange/5 transition"
              >
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="w-4 h-4 accent-power-orange rounded"
                  disabled={loading}
                />
                <span className="text-sm text-slate-700">{amenity}</span>
              </label>
            ))}
          </div>
        </div>

        {/* External Coaches */}
        <div className="flex items-center space-x-2 p-4 bg-power-orange/5 border border-power-orange/20 rounded-lg">
          <input
            type="checkbox"
            name="allowExternalCoaches"
            checked={formData.allowExternalCoaches}
            onChange={handleInputChange}
            className="w-4 h-4 accent-power-orange rounded"
            disabled={loading}
          />
          <label className="text-sm text-slate-700">
            Allow external coaches at your venue?
          </label>
        </div>

        {/* In-House Coaches */}
        <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <input
            type="checkbox"
            name="hasCoaches"
            checked={formData.hasCoaches}
            onChange={handleInputChange}
            className="w-4 h-4 accent-blue-600 rounded"
            disabled={loading}
          />
          <label className="text-sm text-slate-700">
            Do you have in-house coaches? (Add them in the next step)
          </label>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full bg-power-orange hover:bg-orange-600 text-white py-2.5 text-base"
          disabled={loading}
        >
          {loading
            ? "Saving Details..."
            : "Continue to Step 3: Upload Images & Documents"}
        </Button>
        {isDev && onSkip && (
          <Button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2.5 text-base"
          >
            Skip (Dev)
          </Button>
        )}
      </form>
    </div>
  );
}
