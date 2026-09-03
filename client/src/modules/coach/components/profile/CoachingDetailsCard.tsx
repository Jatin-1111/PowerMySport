import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { Coach, ServiceMode } from "@/types";
import { Trash2 } from "lucide-react";
import { RefObject } from "react";

interface CoachingForm {
  selectedSports: string[];
  pricingMode: "SAME" | "PER_SPORT";
  hourlyRateInput: string;
  sportPricing: Record<string, string>;
  serviceMode: ServiceMode;
  serviceRadiusKmInput: string;
  travelBufferTimeInput: string;
}

interface CoachingDetailsCardProps {
  coachProfile: Coach;
  isEditing: boolean;
  isSaving: boolean;
  coachingForm: CoachingForm;
  setCoachingForm: (updater: (prev: CoachingForm) => CoachingForm) => void;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;

  isEditingVenueImages: boolean;
  isUploadingVenueImages: boolean;
  isSavingVenueImages: boolean;
  venueImageDraft: { images: string[]; imageS3Keys: string[] };
  venueImageInputRef: RefObject<HTMLInputElement | null>;
  onEditVenueImagesClick: () => void;
  onCancelVenueImagesEdit: () => void;
  onRemoveVenueImage: (index: number) => void;
  onVenueImagesSelected: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveVenueImages: () => void;
  onSelectVenueImage: (imageUrl: string) => void;
}

export function CoachingDetailsCard({
  coachProfile,
  isEditing,
  isSaving,
  coachingForm,
  setCoachingForm,
  onEditClick,
  onSave,
  onCancel,
  isEditingVenueImages,
  isUploadingVenueImages,
  isSavingVenueImages,
  venueImageDraft,
  venueImageInputRef,
  onEditVenueImagesClick,
  onCancelVenueImagesEdit,
  onRemoveVenueImage,
  onVenueImagesSelected,
  onSaveVenueImages,
  onSelectVenueImage,
}: CoachingDetailsCardProps) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Coaching Details</h3>
        {!isEditing && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onEditClick}
            className="w-full sm:w-auto"
          >
            Edit Details
          </Button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sports You Can Coach
            </label>
            <SportsMultiSelect
              value={coachingForm.selectedSports}
              onChange={(sports) => {
                setCoachingForm((prev) => {
                  const updatedPricing = { ...prev.sportPricing };

                  sports.forEach((sport) => {
                    if (!updatedPricing[sport]) {
                      updatedPricing[sport] =
                        prev.pricingMode === "SAME" ? prev.hourlyRateInput || "" : "";
                    }
                  });

                  Object.keys(updatedPricing).forEach((sport) => {
                    if (!sports.includes(sport)) {
                      delete updatedPricing[sport];
                    }
                  });

                  return {
                    ...prev,
                    selectedSports: sports,
                    sportPricing: updatedPricing,
                  };
                });
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">Pricing</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="profilePricingMode"
                  value="SAME"
                  checked={coachingForm.pricingMode === "SAME"}
                  onChange={() =>
                    setCoachingForm((prev) => {
                      const updatedPricing = {
                        ...prev.sportPricing,
                      };
                      prev.selectedSports.forEach((sport) => {
                        updatedPricing[sport] = prev.hourlyRateInput || "";
                      });

                      return {
                        ...prev,
                        pricingMode: "SAME",
                        sportPricing: updatedPricing,
                      };
                    })
                  }
                />
                Same price for all sports
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="profilePricingMode"
                  value="PER_SPORT"
                  checked={coachingForm.pricingMode === "PER_SPORT"}
                  onChange={() =>
                    setCoachingForm((prev) => ({
                      ...prev,
                      pricingMode: "PER_SPORT",
                    }))
                  }
                />
                Different price per sport
              </label>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {coachingForm.pricingMode === "SAME" ? "Hourly Price" : "Base Hourly Rate"}
              </label>
              <input
                type="number"
                min={1}
                step={0.01}
                value={coachingForm.hourlyRateInput}
                onChange={(event) =>
                  setCoachingForm((prev) => {
                    const nextValue = event.target.value;
                    const updatedPricing = { ...prev.sportPricing };

                    if (prev.pricingMode === "SAME") {
                      prev.selectedSports.forEach((sport) => {
                        updatedPricing[sport] = nextValue;
                      });
                    }

                    return {
                      ...prev,
                      hourlyRateInput: nextValue,
                      sportPricing: updatedPricing,
                    };
                  })
                }
                className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                placeholder="500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Service Mode
              </label>
              <select
                value={coachingForm.serviceMode}
                onChange={(event) =>
                  setCoachingForm((prev) => ({
                    ...prev,
                    serviceMode: event.target.value as ServiceMode,
                  }))
                }
                className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
              >
                <option value="FREELANCE">Freelance</option>
                <option value="OWN_VENUE">Own Venue</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
          </div>

          {coachingForm.pricingMode === "PER_SPORT" && coachingForm.selectedSports.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Price per Sport</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {coachingForm.selectedSports.map((sport) => (
                  <div key={sport}>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                      {sport}
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={0.01}
                      value={coachingForm.sportPricing[sport] || ""}
                      onChange={(event) =>
                        setCoachingForm((prev) => ({
                          ...prev,
                          sportPricing: {
                            ...prev.sportPricing,
                            [sport]: event.target.value,
                          },
                        }))
                      }
                      className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                      placeholder="600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {coachingForm.serviceMode !== "OWN_VENUE" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Service Radius (km)
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={coachingForm.serviceRadiusKmInput}
                  onChange={(event) =>
                    setCoachingForm((prev) => ({
                      ...prev,
                      serviceRadiusKmInput: event.target.value,
                    }))
                  }
                  className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Travel Buffer (minutes)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={coachingForm.travelBufferTimeInput}
                  onChange={(event) =>
                    setCoachingForm((prev) => ({
                      ...prev,
                      travelBufferTimeInput: event.target.value,
                    }))
                  }
                  className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:flex">
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              loading={isSaving}
              className="w-full sm:w-auto"
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Sports You Coach</p>
            <div className="flex flex-wrap gap-2">
              {coachProfile.sports && coachProfile.sports.length > 0 ? (
                coachProfile.sports.map((sport) => (
                  <span
                    key={sport}
                    className="bg-power-orange/10 text-power-orange border-power-orange/20 inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium"
                  >
                    {sport}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500">No sports added yet</p>
              )}
            </div>
          </div>

          {coachProfile.sportPricing && Object.keys(coachProfile.sportPricing).length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                Pricing per Sport
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(coachProfile.sportPricing).map(([sport, price]) => (
                  <div
                    key={sport}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-700">{sport}</span>
                    <span className="text-sm font-semibold text-slate-900">₹{price}/hr</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {coachProfile.hourlyRate && Object.keys(coachProfile.sportPricing ?? {}).length === 0 && (
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Hourly Rate</p>
              <p className="text-power-orange text-2xl font-bold">₹{coachProfile.hourlyRate}/hr</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Service Mode</p>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
              {coachProfile.serviceMode === "OWN_VENUE"
                ? "Own Venue"
                : coachProfile.serviceMode === "HYBRID"
                  ? "Hybrid"
                  : "Freelance"}
            </div>
          </div>

          {(coachProfile.serviceMode === "OWN_VENUE" || coachProfile.serviceMode === "HYBRID") &&
            coachProfile.ownVenueDetails && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">Your Venue</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {coachProfile.ownVenueDetails.name}
                    </p>
                    {coachProfile.ownVenueDetails.address && (
                      <p className="text-sm text-slate-600">
                        {coachProfile.ownVenueDetails.address}
                      </p>
                    )}
                  </div>
                  {coachProfile.ownVenueDetails.description && (
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                        Description
                      </p>
                      <p className="text-sm text-slate-700">
                        {coachProfile.ownVenueDetails.description}
                      </p>
                    </div>
                  )}
                  {coachProfile.ownVenueDetails.openingHours && (
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                        Opening Hours
                      </p>
                      <p className="text-sm text-slate-700">
                        {coachProfile.ownVenueDetails.openingHours}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Venue Images</p>
                      {!isEditingVenueImages ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onEditVenueImagesClick}
                        >
                          Update Images
                        </Button>
                      ) : (
                        <div className="grid gap-2 sm:flex sm:flex-wrap">
                          <input
                            ref={venueImageInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                            onChange={onVenueImagesSelected}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => venueImageInputRef.current?.click()}
                            disabled={isUploadingVenueImages || isSavingVenueImages}
                          >
                            {isUploadingVenueImages ? "Uploading..." : "Add Images"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onCancelVenueImagesEdit}
                            disabled={isUploadingVenueImages || isSavingVenueImages}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={onSaveVenueImages}
                            disabled={isUploadingVenueImages || isSavingVenueImages}
                          >
                            {isSavingVenueImages ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      )}
                    </div>
                    {(() => {
                      const imgs = isEditingVenueImages
                        ? venueImageDraft.images
                        : coachProfile.ownVenueDetails?.images;
                      return imgs && imgs.length > 0;
                    })() ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(isEditingVenueImages
                          ? venueImageDraft.images
                          : (coachProfile.ownVenueDetails?.images ?? [])
                        ).map((imageUrl, index) => (
                          <div
                            key={`${imageUrl}-${index}`}
                            className="group relative overflow-hidden rounded-lg border border-slate-200"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectVenueImage(imageUrl)}
                              className="block w-full"
                            >
                              <img
                                src={imageUrl}
                                alt={`Venue image ${index + 1}`}
                                className="h-32 w-full object-cover"
                              />
                              <div className="pointer-events-none absolute inset-0 bg-slate-900/0 transition-colors group-hover:bg-slate-900/25" />
                              <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-slate-800 opacity-0 transition-opacity group-hover:opacity-100">
                                View
                              </span>
                            </button>
                            {isEditingVenueImages && (
                              <button
                                type="button"
                                onClick={() => onRemoveVenueImage(index)}
                                className="absolute left-2 top-2 rounded-md bg-white/90 p-1 text-red-600 shadow hover:bg-white"
                                aria-label={`Remove venue image ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {isEditingVenueImages
                          ? "No venue images in this draft yet. Add images to update your venue gallery."
                          : "No venue images uploaded yet."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

          {coachProfile.serviceMode !== "OWN_VENUE" && (
            <>
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                  Service Radius
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {coachProfile.serviceRadiusKm || 10} km
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
                  Travel Buffer Time
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {coachProfile.travelBufferTime || 30} minutes
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
