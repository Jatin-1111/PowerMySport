import AmenitiesMultiSelect from "@/modules/shared/components/AmenitiesMultiSelect";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import OpeningHoursInput from "@/modules/onboarding/components/OpeningHoursInput";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { FormErrors, VenueFormData } from "@/modules/admin/utils/venueFormHelpers";
import { Loader2 } from "lucide-react";

interface AddVenueStep2Props {
  loading: boolean;
  errors: FormErrors;
  formData: VenueFormData;
  setFormData: (updater: (prev: VenueFormData) => VenueFormData) => void;
  setErrors: (updater: (prev: FormErrors) => FormErrors) => void;
  venueId: string;
  invalidateDraft: () => void;

  samePriceForAll: boolean;
  onToggleSamePriceMode: (same: boolean) => void;
  basePricePerHour: string;
  onBasePriceChange: (value: number | "") => void;
  onSportPriceChange: (sport: string, price: number) => void;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;

  onBack: () => void;
  onContinue: () => void;
}

export function AddVenueStep2({
  loading,
  errors,
  formData,
  setFormData,
  setErrors,
  venueId,
  invalidateDraft,
  samePriceForAll,
  onToggleSamePriceMode,
  basePricePerHour,
  onBasePriceChange,
  onSportPriceChange,
  handleInputChange,
  onBack,
  onContinue,
}: AddVenueStep2Props) {
  return (
    <Card className="shadow-xs rounded-2xl border border-slate-200 bg-white/90">
      <div className="space-y-6 p-6 md:p-8">
        <OnboardingSectionCard
          title="Venue Details"
          subtitle="Sports, pricing, amenities, and settings"
        >
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Sports Available *
              </label>
              <SportsMultiSelect
                value={formData.sports}
                onChange={(sports) => {
                  if (venueId) {
                    invalidateDraft();
                  }
                  setFormData((prev) => ({
                    ...prev,
                    sports,
                  }));
                  setErrors((prev) => ({
                    ...prev,
                    sports: "",
                    sportPricing: "",
                  }));
                }}
                disabled={loading}
                required
              />
              {errors.sports && <p className="mt-1 text-xs text-red-500">{errors.sports}</p>}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Pricing (per hour) *
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={samePriceForAll}
                    onChange={(e) => onToggleSamePriceMode(e.target.checked)}
                    className="text-power-orange h-4 w-4 rounded"
                    disabled={loading}
                  />
                  Same price for all sports
                </label>
              </div>

              {samePriceForAll ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Base price per hour
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-600">₹</span>
                    <input
                      type="number"
                      value={basePricePerHour}
                      onChange={(e) =>
                        onBasePriceChange(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      min="1"
                      className={`flex-1 rounded-lg border px-3 py-2 transition-colors focus:outline-none focus:ring-2 ${
                        errors.pricePerHour
                          ? "border-red-500 bg-red-50 focus:ring-red-500/40"
                          : "focus:ring-power-orange/40 border-slate-300"
                      }`}
                      placeholder="500"
                      disabled={loading}
                    />
                    <span className="text-slate-600">/hour</span>
                  </div>
                  {errors.pricePerHour && (
                    <p className="mt-1 text-xs text-red-500">{errors.pricePerHour}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                  <h4 className="font-medium text-slate-900">Sport-Specific Pricing</h4>
                  {formData.sports.length === 0 ? (
                    <p className="text-sm text-slate-600">Select sports first</p>
                  ) : (
                    formData.sports.map((sport) => (
                      <div key={sport} className="flex items-center gap-4">
                        <label className="w-32 text-sm font-medium text-slate-700">{sport}</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">₹</span>
                          <input
                            type="number"
                            value={formData.sportPricing[sport] || ""}
                            onChange={(e) =>
                              onSportPriceChange(
                                sport,
                                e.target.value === "" ? 0 : Number(e.target.value)
                              )
                            }
                            min="1"
                            className="focus:ring-power-orange/40 w-24 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2"
                            placeholder="500"
                            disabled={loading}
                          />
                          <span className="text-sm text-slate-600">/hour</span>
                        </div>
                      </div>
                    ))
                  )}
                  {errors.sportPricing && (
                    <p className="mt-2 text-xs text-red-500">{errors.sportPricing}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Amenities</label>
              <AmenitiesMultiSelect
                value={formData.amenities}
                onChange={(amenities) => setFormData((prev) => ({ ...prev, amenities }))}
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Opening Hours</label>
              <OpeningHoursInput
                value={formData.openingHours}
                onChange={(hours) =>
                  setFormData((prev) => ({
                    ...prev,
                    openingHours: hours,
                  }))
                }
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="allowExternalCoaches"
                checked={formData.allowExternalCoaches}
                onChange={handleInputChange}
                disabled={loading}
                className="rounded"
              />
              <span className="text-sm text-slate-700">Allow external coaches at your venue?</span>
            </label>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Approval Status
              </label>
              <select
                name="approvalStatus"
                value={formData.approvalStatus}
                onChange={handleInputChange}
                className="focus:ring-power-orange/40 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2"
                disabled={loading}
              >
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEW">Review</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </OnboardingSectionCard>

        <div className="flex gap-3 border-t pt-4">
          <Button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="bg-slate-600 px-6 text-white hover:bg-slate-700"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={onContinue}
            disabled={loading}
            className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Draft...
              </>
            ) : (
              "Continue to Photos"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
