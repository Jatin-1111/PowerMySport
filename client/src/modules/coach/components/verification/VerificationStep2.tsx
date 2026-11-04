import { GeoSuggestion } from "@/modules/geo/services/geo";
import OpeningHoursInput, {
  OpeningHours,
} from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { ServiceMode } from "@/types";
import { Clock, MapPin } from "lucide-react";

interface VenueDetails {
  name: string;
  address: string;
  description: string;
  openingHours: OpeningHours;
  images: string[];
  imageS3Keys: string[];
}

interface VerificationStep2Props {
  isLockedByReview: boolean;
  saving: boolean;
  isStep2Complete: boolean;

  pricingMode: "SAME" | "PER_SPORT";
  setPricingMode: (mode: "SAME" | "PER_SPORT") => void;
  hourlyRateInput: string;
  setHourlyRateInput: (value: string) => void;
  selectedSports: string[];
  setSelectedSports: (sports: string[]) => void;
  sportPricing: Record<string, string>;
  setSportPricing: (pricing: Record<string, string>) => void;

  serviceMode: ServiceMode;
  venueDetails: VenueDetails;
  setVenueDetails: (updater: (prev: VenueDetails) => VenueDetails) => void;

  addressQuery: string;
  addressSuggestions: GeoSuggestion[];
  isAddressSearching: boolean;
  addressSearchError: string;
  isGeocoding: boolean;
  onAddressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectAddressSuggestion: (suggestion: GeoSuggestion) => void;
  onUseCurrentLocation: () => void;

  serviceRadiusKmInput: string;
  setServiceRadiusKmInput: (value: string) => void;
  travelBufferTimeInput: string;
  setTravelBufferTimeInput: (value: string) => void;

  onBack: () => void;
  onContinue: () => void;
}

export function VerificationStep2({
  isLockedByReview,
  saving,
  isStep2Complete,
  pricingMode,
  setPricingMode,
  hourlyRateInput,
  setHourlyRateInput,
  selectedSports,
  setSelectedSports,
  sportPricing,
  setSportPricing,
  serviceMode,
  venueDetails,
  setVenueDetails,
  addressQuery,
  addressSuggestions,
  isAddressSearching,
  addressSearchError,
  isGeocoding,
  onAddressChange,
  onSelectAddressSuggestion,
  onUseCurrentLocation,
  serviceRadiusKmInput,
  setServiceRadiusKmInput,
  travelBufferTimeInput,
  setTravelBufferTimeInput,
  onBack,
  onContinue,
}: VerificationStep2Props) {
  const addressField = (label: string, placeholder: string) => (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-900">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={addressQuery}
          onChange={onAddressChange}
          disabled={isLockedByReview}
          className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
          placeholder={placeholder}
        />
        {isAddressSearching && (
          <span className="absolute right-3 top-3 text-xs text-slate-500">Searching...</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">Start typing to see suggestions</p>
        <button
          type="button"
          onClick={onUseCurrentLocation}
          className="text-power-orange text-xs font-semibold hover:text-orange-600 disabled:opacity-50"
          disabled={isLockedByReview || isGeocoding}
        >
          {isGeocoding ? "Locating..." : "Use current location"}
        </button>
      </div>
      {addressSearchError && <p className="mt-2 text-xs text-red-500">{addressSearchError}</p>}
      {addressSuggestions.length > 0 && (
        <div className="z-10 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {addressSuggestions.map((suggestion) => (
            <button
              type="button"
              key={`${suggestion.lat}-${suggestion.lon}-${suggestion.label}`}
              onClick={() => onSelectAddressSuggestion(suggestion)}
              className="hover:bg-power-orange/5 w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">Pricing</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="radio"
              name="pricingMode"
              value="SAME"
              checked={pricingMode === "SAME"}
              disabled={isLockedByReview}
              onChange={() => setPricingMode("SAME")}
            />
            Same price for all sports
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <input
              type="radio"
              name="pricingMode"
              value="PER_SPORT"
              checked={pricingMode === "PER_SPORT"}
              disabled={isLockedByReview}
              onChange={() => setPricingMode("PER_SPORT")}
            />
            Different price per sport
          </label>
        </div>
      </div>

      {pricingMode === "SAME" && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">Hourly Price</label>
          <input
            type="number"
            min={1}
            step={0.01}
            value={hourlyRateInput}
            disabled={isLockedByReview}
            onChange={(event) => setHourlyRateInput(event.target.value)}
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
            placeholder="e.g., 500"
          />
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-900">
          Sports You Can Coach
        </label>
        <SportsMultiSelect
          value={selectedSports}
          onChange={(sports) => {
            setSelectedSports(sports);
            // Initialize pricing for new sports
            const updatedPricing = { ...sportPricing };
            sports.forEach((sport) => {
              if (!updatedPricing[sport]) {
                updatedPricing[sport] = pricingMode === "SAME" ? hourlyRateInput || "" : "";
              }
            });
            // Remove pricing for unselected sports
            Object.keys(updatedPricing).forEach((sport) => {
              if (!sports.includes(sport)) {
                delete updatedPricing[sport];
              }
            });
            setSportPricing(updatedPricing);
          }}
          disabled={isLockedByReview}
          required
        />
        <p className="mt-2 text-xs text-slate-500">
          Search for sports or add custom ones. Gemini will verify custom sports automatically.
        </p>
      </div>

      {pricingMode === "PER_SPORT" && selectedSports.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Price per Sport (Hourly Price)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedSports.map((sport) => (
              <div key={sport}>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                  {sport}
                </label>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={sportPricing[sport] || ""}
                  disabled={isLockedByReview}
                  inputMode="decimal"
                  pattern="^\d+(\.\d{1,2})?$"
                  onChange={(event) =>
                    setSportPricing({
                      ...sportPricing,
                      [sport]: event.target.value,
                    })
                  }
                  className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2"
                  placeholder="e.g., 600"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {(serviceMode === "OWN_VENUE" || serviceMode === "HYBRID") && (
        <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-start gap-3">
            <MapPin className="text-power-orange mt-1 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Your Venue Details</p>
              <p className="mt-1 text-sm text-slate-600">
                Provide information about your venue where you&apos;ll conduct coaching sessions.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Venue Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={venueDetails.name}
                onChange={(e) =>
                  setVenueDetails((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
                disabled={isLockedByReview}
                className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
                placeholder="e.g., Elite Sports Arena"
              />
            </div>

            <div className="md:col-span-2">
              {addressField("Venue Address", "Search your venue location")}
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Venue Description
              </label>
              <textarea
                value={venueDetails.description}
                onChange={(e) =>
                  setVenueDetails((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                disabled={isLockedByReview}
                rows={3}
                className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
                placeholder="Describe the facilities, equipment, and amenities available at your venue."
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="text-power-orange h-4 w-4" />
                <label className="block text-sm font-semibold text-slate-900">Opening Hours</label>
              </div>
              <OpeningHoursInput
                value={venueDetails.openingHours}
                onChange={(hours) =>
                  setVenueDetails((prev) => ({
                    ...prev,
                    openingHours: hours,
                  }))
                }
              />
              <p className="mt-2 text-xs text-slate-500">
                Set your venue availability for bookings
              </p>
            </div>
          </div>
        </div>
      )}

      {serviceMode === "FREELANCE" && (
        <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-start gap-3">
            <MapPin className="text-power-orange mt-1 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Service Base Location</p>
              <p className="mt-1 text-sm text-slate-600">
                Set your base location. Only players within your service radius can book you.
              </p>
            </div>
          </div>

          {addressField("Base Address", "Search your base location")}
        </div>
      )}

      {serviceMode !== "OWN_VENUE" && (
        <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
          <p className="text-sm font-semibold text-slate-900">Service Radius Settings</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Service Radius (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={serviceRadiusKmInput}
                disabled={isLockedByReview}
                onChange={(event) => setServiceRadiusKmInput(event.target.value)}
                className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
                placeholder="e.g., 10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Travel Buffer (minutes)
              </label>
              <input
                type="number"
                min={0}
                step={5}
                value={travelBufferTimeInput}
                disabled={isLockedByReview}
                onChange={(event) => setTravelBufferTimeInput(event.target.value)}
                className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
                placeholder="e.g., 30"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
        <Button type="button" variant="secondary" onClick={onBack} className="w-full sm:w-auto">
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onContinue}
          disabled={saving || isLockedByReview || !isStep2Complete}
          className="w-full sm:w-auto"
        >
          {saving ? "Saving..." : "Continue to Final Step"}
        </Button>
      </div>
    </div>
  );
}
