import { GeoSuggestion } from "@/modules/geo/services/geo";
import OnboardingSectionCard from "@/modules/onboarding/components/onboarding/OnboardingSectionCard";
import OpeningHoursInput, {
  OpeningHours,
} from "@/modules/onboarding/components/onboarding/OpeningHoursInput";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { AMENITIES_OPTIONS, getInputClassName } from "@/modules/venue/utils/inventoryFlow";

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

  return (
    <>
      {/* Owner Contact Information */}
      <OnboardingSectionCard
        title="Owner Contact Information"
        subtitle="Your contact details for venue management"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.ownerName}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, ownerName: e.target.value }));
                clearFieldError("ownerName");
              }}
              placeholder="Your full name"
              className={getInputClassName(Boolean(fieldErrors.ownerName))}
              required
            />
            {fieldErrors.ownerName && (
              <p className="mt-1 text-sm text-red-500">{fieldErrors.ownerName}</p>
            )}
            <p className="mt-1 text-xs text-slate-600">This will be your primary contact name</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.ownerEmail}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, ownerEmail: e.target.value }));
                clearFieldError("ownerEmail");
              }}
              placeholder="your.email@example.com"
              className={getInputClassName(Boolean(fieldErrors.ownerEmail))}
              required
            />
            {fieldErrors.ownerEmail && (
              <p className="mt-1 text-sm text-red-500">{fieldErrors.ownerEmail}</p>
            )}
            <p className="mt-1 text-xs text-slate-600">Used for important updates and bookings</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.ownerPhone}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, ownerPhone: e.target.value }));
                clearFieldError("ownerPhone");
              }}
              placeholder="Your phone number"
              className={getInputClassName(Boolean(fieldErrors.ownerPhone))}
              required
            />
            {fieldErrors.ownerPhone && (
              <p className="mt-1 text-sm text-red-500">{fieldErrors.ownerPhone}</p>
            )}
            <p className="mt-1 text-xs text-slate-600">Customers may contact you about bookings</p>
          </div>
        </div>
      </OnboardingSectionCard>

      {/* Venue Details */}
      <OnboardingSectionCard title="Venue Details" subtitle="Basic information about your venue">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Venue Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Elite Sports Arena"
              className={getInputClassName(Boolean(fieldErrors.name))}
              required
            />
            {fieldErrors.name && <p className="mt-1 text-sm text-red-500">{fieldErrors.name}</p>}
            <p className="mt-1 text-xs text-slate-600">This is how customers will see your venue</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              GST Number (optional)
            </label>
            <input
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              value={formData.gstNumber}
              maxLength={15}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))
              }
              placeholder="e.g. 22AAAAA0000A1Z5"
              className={getInputClassName(false)}
            />
            <p className="mt-1 text-xs text-slate-600">
              Only if you&apos;re GST-registered — shown on booking invoices for this venue.
            </p>
          </div>

          <div className="relative">
            <label className="mb-2 block text-sm font-semibold text-slate-900">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addressQuery}
              onChange={onAddressChange}
              placeholder="Search your venue location"
              className={getInputClassName(Boolean(fieldErrors.address))}
              required
            />
            {isSearching && (
              <span className="absolute right-3 top-9 text-xs text-slate-500">Searching…</span>
            )}
            {searchError && <p className="mt-1 text-xs text-red-500">{searchError}</p>}
            {fieldErrors.address && (
              <p className="mt-1 text-sm text-red-500">{fieldErrors.address}</p>
            )}
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.label}
                    onClick={() => onSelectSuggestion(suggestion)}
                    className="w-full border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-600">
              Select from suggestions for accurate location
            </p>
          </div>
        </div>
      </OnboardingSectionCard>

      {/* Sports & Pricing */}
      <OnboardingSectionCard
        title="Sports & Pricing"
        subtitle="Specify which sports you offer and set prices"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-900">
              Sports Available <span className="text-red-500">*</span>
            </label>
            <SportsMultiSelect value={formData.sports} onChange={handleSportsChange} required />
            {fieldErrors.sports && (
              <p className="mt-2 text-sm text-red-500">{fieldErrors.sports}</p>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="mb-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={samePriceForAll}
                onChange={(e) => onToggleSamePriceForAll(e.target.checked)}
                className="accent-power-orange h-4 w-4 rounded"
              />
              <label className="text-sm font-medium text-slate-900">
                Same price for all sports
              </label>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                {samePriceForAll ? "Price per hour" : "Base price per hour"}{" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={basePricePerHour}
                onChange={(e) => onBasePriceChange(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 1500"
                className={getInputClassName(Boolean(fieldErrors.pricePerHour))}
                required
                min="0"
                step="0.01"
              />
              {fieldErrors.pricePerHour && (
                <p className="mt-1 text-sm text-red-500">{fieldErrors.pricePerHour}</p>
              )}
              <p className="mt-1 text-xs text-slate-600">Amount customers pay per hour</p>
            </div>

            {!samePriceForAll && formData.sports.length > 0 && (
              <div className="mt-4 space-y-3 border-t pt-4">
                {formData.sports.map((sport) => (
                  <div key={sport}>
                    <label className="mb-2 block text-sm font-medium text-slate-900">
                      {sport} price per hour
                    </label>
                    <input
                      type="number"
                      value={sportPricing[sport] ?? ""}
                      onChange={(e) => onSportPriceChange(sport, parseFloat(e.target.value) || 0)}
                      placeholder="Enter price"
                      className={getInputClassName(false)}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </OnboardingSectionCard>

      {/* Opening Hours */}
      <OnboardingSectionCard
        title="Operating Hours"
        subtitle="Set your venue's daily operating schedule"
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
      </OnboardingSectionCard>

      {/* Amenities & Description */}
      <OnboardingSectionCard
        title="Amenities & Description"
        subtitle="Tell customers what your venue offers"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-900">Amenities</label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {AMENITIES_OPTIONS.map((amenity) => (
                <label key={amenity} className="flex cursor-pointer items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(amenity)}
                    onChange={() => onToggleAmenity(amenity)}
                    className="text-power-orange h-4 w-4 rounded"
                  />
                  <span className="text-sm text-slate-700">{amenity}</span>
                </label>
              ))}
            </div>
            {fieldErrors.amenities && (
              <p className="mt-2 text-sm text-red-500">{fieldErrors.amenities}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-900">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe your venue, its features, and atmosphere…"
              className={getInputClassName(Boolean(fieldErrors.description))}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-sm text-red-500">{fieldErrors.description}</p>
            )}
            <p className="mt-1 text-xs text-slate-600">
              A detailed description helps attract more customers
            </p>
          </div>
        </div>
      </OnboardingSectionCard>
    </>
  );
}
