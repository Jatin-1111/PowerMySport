import { GeoSuggestion } from "@/modules/geo/services/geo";
import OpeningHoursInput, { OpeningHours } from "@/modules/onboarding/components/OpeningHoursInput";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import { FormErrors, PricingMode } from "@/modules/admin/utils/coachOnboardingHelpers";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { ServiceMode } from "@/types";
import { MapPin } from "lucide-react";

interface CoachOnboardingStep2Props {
  loading: boolean;
  errors: FormErrors;

  sports: string[];
  setSports: (value: string[]) => void;
  pricingMode: PricingMode;
  setPricingMode: (mode: PricingMode) => void;
  hourlyRateInput: string;
  setHourlyRateInput: (value: string) => void;
  sportPricing: Record<string, string>;
  setSportPricing: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  setErrors: (updater: (prev: FormErrors) => FormErrors) => void;

  serviceMode: ServiceMode;
  setServiceMode: (mode: ServiceMode) => void;
  needsBaseLocation: boolean;
  isOwnVenue: boolean;

  baseLocationQuery: string;
  setBaseLocationQuery: (value: string) => void;
  setBaseLocation: (value: [number, number] | null) => void;
  baseLocationSuggestions: GeoSuggestion[];
  baseLocationSearching: boolean;
  baseLocationError: string;
  setBaseLocationError: (value: string) => void;
  onSelectBaseLocation: (suggestion: GeoSuggestion) => void;

  serviceRadiusKmInput: string;
  setServiceRadiusKmInput: (value: string) => void;
  travelBufferTimeInput: string;
  setTravelBufferTimeInput: (value: string) => void;

  venueName: string;
  setVenueName: (value: string) => void;
  venueAddressQuery: string;
  setVenueAddressQuery: (value: string) => void;
  setVenueLocation: (value: [number, number] | null) => void;
  venueAddressSuggestions: GeoSuggestion[];
  venueAddressSearching: boolean;
  venueAddressError: string;
  setVenueAddressError: (value: string) => void;
  onSelectVenueLocation: (suggestion: GeoSuggestion) => void;
  venueDescription: string;
  setVenueDescription: (value: string) => void;
  venueOpeningHours: OpeningHours;
  setVenueOpeningHours: (hours: OpeningHours) => void;

  onBack: () => void;
  onContinue: () => void;
}

export function CoachOnboardingStep2({
  loading,
  errors,
  sports,
  setSports,
  pricingMode,
  setPricingMode,
  hourlyRateInput,
  setHourlyRateInput,
  sportPricing,
  setSportPricing,
  setErrors,
  serviceMode,
  setServiceMode,
  needsBaseLocation,
  isOwnVenue,
  baseLocationQuery,
  setBaseLocationQuery,
  setBaseLocation,
  baseLocationSuggestions,
  baseLocationSearching,
  baseLocationError,
  setBaseLocationError,
  onSelectBaseLocation,
  serviceRadiusKmInput,
  setServiceRadiusKmInput,
  travelBufferTimeInput,
  setTravelBufferTimeInput,
  venueName,
  setVenueName,
  venueAddressQuery,
  setVenueAddressQuery,
  setVenueLocation,
  venueAddressSuggestions,
  venueAddressSearching,
  venueAddressError,
  setVenueAddressError,
  onSelectVenueLocation,
  venueDescription,
  setVenueDescription,
  venueOpeningHours,
  setVenueOpeningHours,
  onBack,
  onContinue,
}: CoachOnboardingStep2Props) {
  return (
    <div className="space-y-6">
      <OnboardingSectionCard
        title="Coaching setup"
        subtitle="Match the client flow: sports, pricing, service mode, and service location."
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Pricing</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="radio"
                name="pricingMode"
                checked={pricingMode === "SAME"}
                onChange={() => setPricingMode("SAME")}
                disabled={loading}
              />
              Same price for all sports
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                type="radio"
                name="pricingMode"
                checked={pricingMode === "PER_SPORT"}
                onChange={() => setPricingMode("PER_SPORT")}
                disabled={loading}
              />
              Different price per sport
            </label>
          </div>
        </div>

        {pricingMode === "SAME" ? (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">Hourly rate *</label>
            <input
              type="number"
              min={1}
              step={0.01}
              value={hourlyRateInput}
              onChange={(event) => setHourlyRateInput(event.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                errors.hourlyRate
                  ? "border-red-400 focus:ring-red-200"
                  : "focus:ring-power-orange/30 border-slate-300"
              }`}
              placeholder="500"
              disabled={loading}
            />
            {errors.hourlyRate ? (
              <p className="mt-1 text-xs text-red-600">{errors.hourlyRate}</p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-900">
            Sports you can coach *
          </label>
          <SportsMultiSelect
            value={sports}
            onChange={(nextSports) => {
              setSports(nextSports);
              setErrors((prev) => ({ ...prev, sports: "" }));
              setSportPricing((prev) => {
                const updated = { ...prev };
                for (const sport of nextSports) {
                  if (!updated[sport]) {
                    updated[sport] = pricingMode === "SAME" ? hourlyRateInput : "";
                  }
                }
                for (const sport of Object.keys(updated)) {
                  if (!nextSports.includes(sport)) {
                    delete updated[sport];
                  }
                }
                return updated;
              });
            }}
            disabled={loading}
            required
          />
          {errors.sports ? <p className="mt-1 text-xs text-red-600">{errors.sports}</p> : null}
        </div>

        {pricingMode === "PER_SPORT" && sports.length > 0 ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Price per sport</p>
            {sports.map((sport) => (
              <div key={sport} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <label className="w-40 text-sm font-medium text-slate-700">{sport}</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">₹</span>
                  <input
                    type="number"
                    min={1}
                    step={0.01}
                    value={sportPricing[sport] || ""}
                    onChange={(event) =>
                      setSportPricing((prev) => ({
                        ...prev,
                        [sport]: event.target.value,
                      }))
                    }
                    className="focus:ring-power-orange/30 w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2"
                    placeholder="500"
                    disabled={loading}
                  />
                </div>
              </div>
            ))}
            {errors.sportPricing ? (
              <p className="text-xs text-red-600">{errors.sportPricing}</p>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-900">Service mode</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["OWN_VENUE", "Own venue"],
                ["FREELANCE", "Freelance"],
                ["HYBRID", "Hybrid"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setServiceMode(value)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  serviceMode === value
                    ? "border-power-orange text-power-orange bg-orange-50"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                disabled={loading}
              >
                <p className="font-semibold">{label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {value === "OWN_VENUE" && "Coach teaches from a private venue."}
                  {value === "FREELANCE" && "Coach travels to players' locations."}
                  {value === "HYBRID" && "Coach offers both venue and travel options."}
                </p>
              </button>
            ))}
          </div>
        </div>

        {needsBaseLocation ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <MapPin className="text-power-orange h-4 w-4" />
              <p className="text-sm font-semibold text-slate-900">Base location</p>
            </div>
            <div>
              <input
                value={baseLocationQuery}
                onChange={(event) => {
                  setBaseLocationQuery(event.target.value);
                  setBaseLocation(null);
                  setBaseLocationError("");
                }}
                placeholder="Search base location"
                className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                  errors.baseLocation
                    ? "border-red-400 focus:ring-red-200"
                    : "focus:ring-power-orange/30 border-slate-300"
                }`}
                disabled={loading}
              />
              {baseLocationSearching ? (
                <p className="mt-1 text-xs text-slate-500">Searching...</p>
              ) : null}
              {baseLocationError ? (
                <p className="mt-1 text-xs text-red-600">{baseLocationError}</p>
              ) : null}
              {baseLocationSuggestions.length > 0 ? (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  {baseLocationSuggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                      type="button"
                      onClick={() => onSelectBaseLocation(suggestion)}
                      className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {errors.baseLocation ? (
              <p className="text-xs text-red-600">{errors.baseLocation}</p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Service radius (km) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={serviceRadiusKmInput}
                  onChange={(event) => setServiceRadiusKmInput(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                    errors.serviceRadiusKm
                      ? "border-red-400 focus:ring-red-200"
                      : "focus:ring-power-orange/30 border-slate-300"
                  }`}
                  disabled={loading}
                />
                {errors.serviceRadiusKm ? (
                  <p className="mt-1 text-xs text-red-600">{errors.serviceRadiusKm}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Travel buffer time (minutes) *
                </label>
                <input
                  type="number"
                  min={0}
                  value={travelBufferTimeInput}
                  onChange={(event) => setTravelBufferTimeInput(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                    errors.travelBufferTime
                      ? "border-red-400 focus:ring-red-200"
                      : "focus:ring-power-orange/30 border-slate-300"
                  }`}
                  disabled={loading}
                />
                {errors.travelBufferTime ? (
                  <p className="mt-1 text-xs text-red-600">{errors.travelBufferTime}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {isOwnVenue ? (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Venue details</p>
              <p className="mt-1 text-xs text-slate-500">
                Admins can enter and lock these details on the coach&apos;s behalf.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Venue name *
                </label>
                <input
                  value={venueName}
                  onChange={(event) => setVenueName(event.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                    errors.venueName
                      ? "border-red-400 focus:ring-red-200"
                      : "focus:ring-power-orange/30 border-slate-300"
                  }`}
                  placeholder="Venue name"
                  disabled={loading}
                />
                {errors.venueName ? (
                  <p className="mt-1 text-xs text-red-600">{errors.venueName}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Venue address *
                </label>
                <input
                  value={venueAddressQuery}
                  onChange={(event) => {
                    setVenueAddressQuery(event.target.value);
                    setVenueLocation(null);
                    setVenueAddressError("");
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-slate-900 outline-none transition focus:ring-2 ${
                    errors.venueAddress
                      ? "border-red-400 focus:ring-red-200"
                      : "focus:ring-power-orange/30 border-slate-300"
                  }`}
                  placeholder="Search venue address"
                  disabled={loading}
                />
                {venueAddressSearching ? (
                  <p className="mt-1 text-xs text-slate-500">Searching...</p>
                ) : null}
                {venueAddressError ? (
                  <p className="mt-1 text-xs text-red-600">{venueAddressError}</p>
                ) : null}
                {venueAddressSuggestions.length > 0 ? (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    {venueAddressSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`}
                        type="button"
                        onClick={() => onSelectVenueLocation(suggestion)}
                        className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            {errors.venueAddress ? (
              <p className="text-xs text-red-600">{errors.venueAddress}</p>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Venue description
              </label>
              <textarea
                value={venueDescription}
                onChange={(event) => setVenueDescription(event.target.value)}
                rows={4}
                className="focus:ring-power-orange/30 w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:ring-2"
                placeholder="Optional venue description"
                disabled={loading}
              />
            </div>

            <OpeningHoursInput value={venueOpeningHours} onChange={setVenueOpeningHours} />
          </div>
        ) : null}
      </OnboardingSectionCard>

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack} disabled={loading}>
          Back
        </Button>
        <Button type="button" variant="primary" onClick={onContinue} disabled={loading}>
          Continue to review
        </Button>
      </div>
    </div>
  );
}
