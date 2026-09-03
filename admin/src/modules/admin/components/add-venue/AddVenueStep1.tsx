import { GeoSuggestion } from "@/modules/geo/services/geo";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { FormErrors, VenueFormData } from "@/modules/admin/utils/venueFormHelpers";
import { Loader2 } from "lucide-react";

interface AddVenueStep1Props {
  loading: boolean;
  errors: FormErrors;
  formData: VenueFormData;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;

  addressQuery: string;
  setAddressQuery: (value: string) => void;
  suggestions: GeoSuggestion[];
  isSearching: boolean;
  onSelectSuggestion: (suggestion: GeoSuggestion) => void;
  onClearLocation: () => void;

  onSubmit: () => void;
  onCancel: () => void;
}

export function AddVenueStep1({
  loading,
  errors,
  formData,
  handleInputChange,
  addressQuery,
  setAddressQuery,
  suggestions,
  isSearching,
  onSelectSuggestion,
  onClearLocation,
  onSubmit,
  onCancel,
}: AddVenueStep1Props) {
  return (
    <Card className="shadow-xs rounded-2xl border border-slate-200 bg-white/90">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="space-y-6 p-6 md:p-8"
      >
        <OnboardingSectionCard
          title="Basic Details"
          subtitle="Owner contact, name, address, and description"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Owner Name *</label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleInputChange}
                className={`w-full rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 ${
                  errors.ownerName
                    ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                    : "focus:ring-power-orange/40 border-slate-300"
                }`}
                placeholder="Enter owner name"
                disabled={loading}
              />
              {errors.ownerName && <p className="mt-1 text-xs text-red-500">{errors.ownerName}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Owner Email *</label>
              <input
                type="email"
                name="ownerEmail"
                value={formData.ownerEmail}
                onChange={handleInputChange}
                className={`w-full rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 ${
                  errors.ownerEmail
                    ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                    : "focus:ring-power-orange/40 border-slate-300"
                }`}
                placeholder="Enter owner email"
                disabled={loading}
              />
              {errors.ownerEmail && (
                <p className="mt-1 text-xs text-red-500">{errors.ownerEmail}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Owner Mobile Number *
            </label>
            <input
              type="tel"
              name="ownerPhone"
              value={formData.ownerPhone}
              onChange={handleInputChange}
              maxLength={20}
              className={`w-full rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 ${
                errors.ownerPhone
                  ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                  : "focus:ring-power-orange/40 border-slate-300"
              }`}
              placeholder="Enter owner mobile number"
              disabled={loading}
            />
            {errors.ownerPhone && <p className="mt-1 text-xs text-red-500">{errors.ownerPhone}</p>}
            <p className="mt-1 text-xs text-slate-600">
              Supports +91 prefix and common phone number formatting
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Venue Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 ${
                errors.name
                  ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                  : "focus:ring-power-orange/40 border-slate-300"
              }`}
              placeholder="Enter venue name"
              disabled={loading}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Address *</label>
            <input
              type="text"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 ${
                errors.address
                  ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                  : "focus:ring-power-orange/40 border-slate-300"
              }`}
              placeholder="Start typing address and pick suggestion"
              disabled={loading}
            />

            {isSearching && <p className="mt-1 text-sm text-slate-500">Searching...</p>}
            {suggestions.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-auto rounded-md border bg-white shadow-md">
                {suggestions.map((suggestion) => (
                  <li
                    key={suggestion.label}
                    className="cursor-pointer border-b px-3 py-2 last:border-b-0 hover:bg-slate-50"
                    onClick={() => onSelectSuggestion(suggestion)}
                  >
                    {suggestion.label}
                  </li>
                ))}
              </ul>
            )}

            {formData.location && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-green-300 bg-green-50 p-3">
                <div className="text-sm font-medium text-slate-800">{formData.address}</div>
                <button
                  type="button"
                  onClick={onClearLocation}
                  className="text-sm text-slate-600 transition-colors hover:text-red-600"
                >
                  Clear
                </button>
              </div>
            )}

            {errors.address && <p className="mt-1 text-xs text-red-500">{errors.address}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              maxLength={500}
              className="focus:ring-power-orange/40 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2"
              placeholder="Tell users about your venue"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-slate-600">
              {formData.description.length}/500 characters
            </p>
          </div>
        </OnboardingSectionCard>

        <div className="flex gap-3 border-t pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Continue to Step 2"
            )}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="bg-slate-600 px-6 text-white hover:bg-slate-700"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
