import { Button } from "@/modules/shared/ui/Button";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { formatRupees } from "@/modules/shared/utils/figures";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { Coach, ServiceMode } from "@/types";
import { Trash2 } from "lucide-react";
import { RefObject } from "react";
import { serviceModeLabel } from "../../utils/overview";
import {
  EditLink,
  FIELD_INPUT,
  FIELD_LABEL,
  FormActions,
  ProfileFacts,
  ProfileSection,
} from "@/modules/shared/components/settings/ProfileSection";

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

const SERVICE_MODE_OPTIONS: Array<{ value: ServiceMode; label: string }> = [
  { value: "FREELANCE", label: "Travelling to clients" },
  { value: "OWN_VENUE", label: "At my own venue" },
  { value: "HYBRID", label: "Own venue and travelling" },
];

export function CoachingDetailsCard(props: CoachingDetailsCardProps) {
  const { isEditing, isSaving, onEditClick, onSave, onCancel } = props;

  return (
    <ProfileSection
      id="coaching"
      title="Coaching"
      description="The sports you coach, your rates, and where you coach."
      action={!isEditing && <EditLink onClick={onEditClick} label="Edit coaching details" />}
    >
      {isEditing ? (
        <CoachingForm {...props} onSave={onSave} onCancel={onCancel} isSaving={isSaving} />
      ) : (
        <CoachingView {...props} />
      )}
    </ProfileSection>
  );
}

function CoachingForm({
  coachingForm,
  setCoachingForm,
  isSaving,
  onSave,
  onCancel,
}: Pick<
  CoachingDetailsCardProps,
  "coachingForm" | "setCoachingForm" | "isSaving" | "onSave" | "onCancel"
>) {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <span className={FIELD_LABEL}>Sports you coach</span>
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

      <fieldset>
        <legend className={FIELD_LABEL}>Pricing</legend>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <label className="text-ink flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="profilePricingMode"
              value="SAME"
              checked={coachingForm.pricingMode === "SAME"}
              onChange={() =>
                setCoachingForm((prev) => {
                  const updatedPricing = { ...prev.sportPricing };
                  prev.selectedSports.forEach((sport) => {
                    updatedPricing[sport] = prev.hourlyRateInput || "";
                  });

                  return { ...prev, pricingMode: "SAME", sportPricing: updatedPricing };
                })
              }
            />
            Same price for all sports
          </label>
          <label className="text-ink flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="profilePricingMode"
              value="PER_SPORT"
              checked={coachingForm.pricingMode === "PER_SPORT"}
              onChange={() => setCoachingForm((prev) => ({ ...prev, pricingMode: "PER_SPORT" }))}
            />
            Different price per sport
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="coaching-rate" className={FIELD_LABEL}>
            {coachingForm.pricingMode === "SAME" ? "Hourly price (₹)" : "Base hourly rate (₹)"}
          </label>
          <input
            id="coaching-rate"
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

                return { ...prev, hourlyRateInput: nextValue, sportPricing: updatedPricing };
              })
            }
            className={FIELD_INPUT}
            placeholder="500"
          />
        </div>

        <div>
          <label htmlFor="coaching-mode" className={FIELD_LABEL}>
            How you coach
          </label>
          <select
            id="coaching-mode"
            value={coachingForm.serviceMode}
            onChange={(event) =>
              setCoachingForm((prev) => ({
                ...prev,
                serviceMode: event.target.value as ServiceMode,
              }))
            }
            className={FIELD_INPUT}
          >
            {SERVICE_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {coachingForm.pricingMode === "PER_SPORT" && coachingForm.selectedSports.length > 0 && (
        <fieldset>
          <legend className={FIELD_LABEL}>{"Rate for each sport (₹ an hour)"}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {coachingForm.selectedSports.map((sport) => (
              <div key={sport}>
                <label
                  htmlFor={`coaching-rate-${sport}`}
                  className="text-ink-body mb-1.5 block text-sm"
                >
                  {sport}
                </label>
                <input
                  id={`coaching-rate-${sport}`}
                  type="number"
                  min={1}
                  step={0.01}
                  value={coachingForm.sportPricing[sport] || ""}
                  onChange={(event) =>
                    setCoachingForm((prev) => ({
                      ...prev,
                      sportPricing: { ...prev.sportPricing, [sport]: event.target.value },
                    }))
                  }
                  className={FIELD_INPUT}
                  placeholder="600"
                />
              </div>
            ))}
          </div>
        </fieldset>
      )}

      {coachingForm.serviceMode !== "OWN_VENUE" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="coaching-radius" className={FIELD_LABEL}>
              Travel radius (km)
            </label>
            <input
              id="coaching-radius"
              type="number"
              min={1}
              step={1}
              value={coachingForm.serviceRadiusKmInput}
              onChange={(event) =>
                setCoachingForm((prev) => ({ ...prev, serviceRadiusKmInput: event.target.value }))
              }
              className={FIELD_INPUT}
            />
          </div>

          <div>
            <label htmlFor="coaching-buffer" className={FIELD_LABEL}>
              Travel buffer (minutes)
            </label>
            <input
              id="coaching-buffer"
              type="number"
              min={0}
              step={1}
              value={coachingForm.travelBufferTimeInput}
              onChange={(event) =>
                setCoachingForm((prev) => ({ ...prev, travelBufferTimeInput: event.target.value }))
              }
              className={FIELD_INPUT}
            />
          </div>
        </div>
      )}

      <FormActions onSave={onSave} onCancel={onCancel} saving={isSaving} />
    </div>
  );
}

function CoachingView({
  coachProfile,
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
  const sports = coachProfile.sports ?? [];
  const perSport = Object.entries(coachProfile.sportPricing ?? {});
  const hasVenue =
    (coachProfile.serviceMode === "OWN_VENUE" || coachProfile.serviceMode === "HYBRID") &&
    Boolean(coachProfile.ownVenueDetails);
  const venue = coachProfile.ownVenueDetails;

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Sports", value: sports.length > 0 ? sports.join(", ") : "None added yet" },
    ...(perSport.length > 0
      ? perSport.map(([sport, price]) => ({
          label: `${sport} rate`,
          value: <span className="tabular-nums">{formatRupees(Number(price))} an hour</span>,
        }))
      : coachProfile.hourlyRate
        ? [
            {
              label: "Rate",
              value: (
                <span className="tabular-nums">
                  {formatRupees(coachProfile.hourlyRate)} an hour
                </span>
              ),
            },
          ]
        : []),
    { label: "How you coach", value: serviceModeLabel(coachProfile.serviceMode) },
    ...(coachProfile.serviceMode !== "OWN_VENUE"
      ? [
          {
            label: "Travel radius",
            value: <span className="tabular-nums">{coachProfile.serviceRadiusKm || 10} km</span>,
          },
          {
            label: "Travel buffer",
            value: (
              <span className="tabular-nums">{coachProfile.travelBufferTime || 30} minutes</span>
            ),
          },
        ]
      : []),
    ...(hasVenue && venue
      ? [
          {
            label: "Your venue",
            value: (
              <>
                {venue.name}
                {venue.address && (
                  <span className="text-ink-body block font-normal">{venue.address}</span>
                )}
              </>
            ),
          },
          ...(venue.description ? [{ label: "About the venue", value: venue.description }] : []),
          ...(venue.openingHours ? [{ label: "Opening hours", value: venue.openingHours }] : []),
        ]
      : []),
  ];

  const images = isEditingVenueImages ? venueImageDraft.images : (venue?.images ?? []);

  return (
    <div className="space-y-8">
      <ProfileFacts rows={rows} />

      {hasVenue && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h3 className="text-ink text-sm font-medium">Venue photos</h3>
            {!isEditingVenueImages ? (
              <EditLink onClick={onEditVenueImagesClick} label="Update photos" />
            ) : (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <input
                  ref={venueImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={onVenueImagesSelected}
                />
                <button
                  type="button"
                  className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50`}
                  onClick={() => venueImageInputRef.current?.click()}
                  disabled={isUploadingVenueImages || isSavingVenueImages}
                >
                  {isUploadingVenueImages ? "Uploading" : "Add photos"}
                </button>
                <button
                  type="button"
                  className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50`}
                  onClick={onCancelVenueImagesEdit}
                  disabled={isUploadingVenueImages || isSavingVenueImages}
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11"
                  onClick={onSaveVenueImages}
                  disabled={isUploadingVenueImages || isSavingVenueImages}
                >
                  {isSavingVenueImages ? "Saving" : "Save photos"}
                </Button>
              </div>
            )}
          </div>

          {images.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-${index}`}
                  className="group relative overflow-hidden rounded-md"
                >
                  <button
                    type="button"
                    onClick={() => onSelectVenueImage(imageUrl)}
                    className="focus-visible:ring-ink block w-full focus-visible:outline-none focus-visible:ring-2"
                    aria-label={`View venue photo ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={`Venue photo ${index + 1}`}
                      className="h-36 w-full object-cover"
                    />
                  </button>
                  {isEditingVenueImages && (
                    <button
                      type="button"
                      onClick={() => onRemoveVenueImage(index)}
                      className="absolute left-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-md bg-white/90 text-red-800 hover:bg-white"
                      aria-label={`Remove venue photo ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-ink-body mt-3">
              {isEditingVenueImages
                ? "No photos in this draft yet. Add photos to update your venue gallery."
                : "No venue photos yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
