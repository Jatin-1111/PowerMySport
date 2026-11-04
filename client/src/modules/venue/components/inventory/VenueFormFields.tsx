import { GeoSuggestion } from "@/modules/geo/services/geo";
import OpeningHoursInput, {
  OpeningHours,
} from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import {
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
  ProfileSection,
} from "@/modules/shared/components/settings/ProfileSection";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { cn } from "@/utils/cn";
import { AMENITIES_OPTIONS } from "@/modules/venue/utils/inventoryFlow";
import type { ReactNode } from "react";

interface VenueFormData {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  name: string;
  address: string;
  location: { lat: number; lng: number } | null;
  sports: string[];
  pricePerHour: string;
  amenities: string;
  description: string;
  gstNumber: string;
  openingHours: OpeningHours;
}

interface VenueFormFieldsProps {
  formData: VenueFormData;
  setFormData: (updater: (prev: VenueFormData) => VenueFormData) => void;
  fieldErrors: Record<string, string>;
  setFieldErrors: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSportsChange: (sports: string[]) => void;

  addressQuery: string;
  suggestions: GeoSuggestion[];
  isSearching: boolean;
  searchError: string;
  onAddressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectSuggestion: (suggestion: GeoSuggestion) => void;

  samePriceForAll: boolean;
  onToggleSamePriceForAll: (checked: boolean) => void;
  basePricePerHour: number;
  onBasePriceChange: (value: number) => void;
  sportPricing: Record<string, number>;
  onSportPriceChange: (sport: string, value: number) => void;

  selectedAmenities: string[];
  onToggleAmenity: (amenity: string) => void;
}

const ERROR_INPUT = "border-red-700 focus:border-red-700";

/** A labelled field: label above, the control, then the error or the hint. */
function Field({
  id,
  label,
  optional,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
        {optional && <span className="text-ink-body font-normal"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm text-red-800">
          {error}
        </p>
      ) : (
        hint && <p className={FIELD_HINT}>{hint}</p>
      )}
    </div>
  );
}

export function VenueFormFields({
  formData,
  setFormData,
  fieldErrors,
  setFieldErrors,
  handleChange,
  handleSportsChange,
  addressQuery,
  suggestions,
  isSearching,
  searchError,
  onAddressChange,
  onSelectSuggestion,
  samePriceForAll,
  onToggleSamePriceForAll,
  basePricePerHour,
  onBasePriceChange,
  sportPricing,
  onSportPriceChange,
  selectedAmenities,
  onToggleAmenity,
}: VenueFormFieldsProps) {
  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const input = (field: string) => cn(FIELD_INPUT, fieldErrors[field] && ERROR_INPUT);

  return (
    <div>
      <ProfileSection
        id="owner"
        title="Your contact details"
        description="Where we reach you about bookings and reviews of this venue."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="venue-owner-name" label="Full name" error={fieldErrors.ownerName}>
            <input
              id="venue-owner-name"
              type="text"
              value={formData.ownerName}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, ownerName: e.target.value }));
                clearFieldError("ownerName");
              }}
              autoComplete="name"
              className={input("ownerName")}
              required
            />
          </Field>
          <Field id="venue-owner-phone" label="Phone number" error={fieldErrors.ownerPhone}>
            <input
              id="venue-owner-phone"
              type="tel"
              value={formData.ownerPhone}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, ownerPhone: e.target.value }));
                clearFieldError("ownerPhone");
              }}
              autoComplete="tel"
              className={input("ownerPhone")}
              required
            />
          </Field>
          <div className="md:col-span-2">
            <Field id="venue-owner-email" label="Email address" error={fieldErrors.ownerEmail}>
              <input
                id="venue-owner-email"
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, ownerEmail: e.target.value }));
                  clearFieldError("ownerEmail");
                }}
                autoComplete="email"
                className={input("ownerEmail")}
                required
              />
            </Field>
          </div>
        </div>
      </ProfileSection>

      <ProfileSection
        id="details"
        title="About the venue"
        description="How players will find and recognise it."
      >
        <div className="space-y-5">
          <Field
            id="venue-name"
            label="Venue name"
            error={fieldErrors.name}
            hint="This is how players see your venue."
          >
            <input
              id="venue-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={input("name")}
              required
            />
          </Field>

          <div className="relative">
            <Field
              id="venue-address"
              label="Address"
              error={fieldErrors.address || searchError}
              hint="Pick one of the suggestions so the location on the map is exact."
            >
              <input
                id="venue-address"
                type="text"
                value={addressQuery}
                onChange={onAddressChange}
                placeholder="Search for your venue"
                autoComplete="off"
                className={input("address")}
                required
              />
            </Field>
            {isSearching && (
              <span className="text-ink-body absolute right-3 top-9 text-sm" role="status">
                Searching
              </span>
            )}
            {suggestions.length > 0 && (
              <ul className="border-hairline bg-paper absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.label} className="border-hairline border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onSelectSuggestion(suggestion)}
                      className="text-ink hover:bg-paper-deep min-h-11 w-full px-4 py-2 text-left text-sm"
                    >
                      {suggestion.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field
            id="venue-description"
            label="Description"
            optional
            error={fieldErrors.description}
            hint="Surface, lighting, parking and anything else a player would ask."
          >
            <textarea
              id="venue-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className={input("description")}
            />
          </Field>

          <Field
            id="venue-gst"
            label="GST number"
            optional
            hint="Only if you are GST-registered. It is shown on invoices for this venue."
          >
            <input
              id="venue-gst"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              value={formData.gstNumber}
              maxLength={15}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))
              }
              className={FIELD_INPUT}
            />
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection
        id="pricing"
        title="Sports and pricing"
        description="Which sports you offer, and what an hour costs."
      >
        <div className="space-y-6">
          <div>
            <p className={FIELD_LABEL}>Sports available</p>
            <SportsMultiSelect value={formData.sports} onChange={handleSportsChange} required />
            {fieldErrors.sports && (
              <p role="alert" className="mt-1.5 text-sm text-red-800">
                {fieldErrors.sports}
              </p>
            )}
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={samePriceForAll}
              onChange={(e) => onToggleSamePriceForAll(e.target.checked)}
              className="accent-ink h-4 w-4"
            />
            <span className="text-ink text-sm font-medium">One price for every sport</span>
          </label>

          <Field
            id="venue-price"
            label={samePriceForAll ? "Price per hour (₹)" : "Base price per hour (₹)"}
            error={fieldErrors.pricePerHour}
          >
            <input
              id="venue-price"
              type="number"
              inputMode="decimal"
              value={basePricePerHour}
              onChange={(e) => onBasePriceChange(parseFloat(e.target.value) || 0)}
              className={cn(input("pricePerHour"), "tabular-nums md:max-w-xs")}
              required
              min="0"
              step="0.01"
            />
          </Field>

          {!samePriceForAll && formData.sports.length > 0 && (
            <div className="border-hairline grid gap-5 border-t pt-6 md:grid-cols-2">
              {formData.sports.map((sport) => (
                <Field
                  key={sport}
                  id={`venue-price-${sport}`}
                  label={`${sport}, price per hour (₹)`}
                >
                  <input
                    id={`venue-price-${sport}`}
                    type="number"
                    inputMode="decimal"
                    value={sportPricing[sport] ?? ""}
                    onChange={(e) => onSportPriceChange(sport, parseFloat(e.target.value) || 0)}
                    className={cn(FIELD_INPUT, "tabular-nums")}
                    required
                    min="0"
                    step="0.01"
                  />
                </Field>
              ))}
            </div>
          )}
        </div>
      </ProfileSection>

      <ProfileSection
        id="hours"
        title="Opening hours"
        description="When players can book. Close any day you are not open."
      >
        <OpeningHoursInput
          value={formData.openingHours}
          onChange={(hours) => {
            const validatedHours = Object.fromEntries(
              Object.entries(hours).map(([day, hourData]) => [
                day,
                {
                  isOpen: hourData.isOpen,
                  openTime: hourData.openTime || "09:00",
                  closeTime: hourData.closeTime || "21:00",
                },
              ])
            ) as unknown as typeof formData.openingHours;

            setFormData((prev) => ({
              ...prev,
              openingHours: validatedHours,
            }));
          }}
        />
      </ProfileSection>

      <ProfileSection
        id="amenities"
        title="Amenities"
        description="What a player can use at the venue."
      >
        <fieldset>
          <legend className="sr-only">Amenities</legend>
          <div className="grid grid-cols-2 gap-x-6 md:grid-cols-3">
            {AMENITIES_OPTIONS.map((amenity) => (
              <label key={amenity} className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => onToggleAmenity(amenity)}
                  className="accent-ink h-4 w-4"
                />
                <span className="text-ink text-sm">{amenity}</span>
              </label>
            ))}
          </div>
          {fieldErrors.amenities && (
            <p role="alert" className="mt-2 text-sm text-red-800">
              {fieldErrors.amenities}
            </p>
          )}
        </fieldset>
      </ProfileSection>
    </div>
  );
}
