import VenueImageUpload from "@/modules/admin/components/VenueImageUpload";
import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { VenueFormData } from "@/modules/admin/utils/venueFormHelpers";

interface AddVenueStep3Props {
  loading: boolean;
  venueId: string;
  formData: VenueFormData;
  onImagesReady: (images: {
    generalImages: string[];
    generalImageKeys: string[];
    sportImages: Record<string, string[]>;
    sportImageKeys: Record<string, string[]>;
    coverPhotoUrl: string;
    coverPhotoKey: string;
  }) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function AddVenueStep3({
  loading,
  venueId,
  formData,
  onImagesReady,
  onBack,
  onContinue,
}: AddVenueStep3Props) {
  return (
    <Card className="shadow-xs rounded-2xl border border-slate-200 bg-white/90">
      <div className="space-y-6 p-6 md:p-8">
        <OnboardingSectionCard
          title="Venue Photos"
          subtitle="Upload 3 general images and 5 per sport"
        >
          {venueId ? (
            <VenueImageUpload
              venueId={venueId}
              sports={formData.sports}
              onImagesReady={onImagesReady}
              disabled={loading}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">
              Create the draft venue from Step 2 before uploading photos.
            </div>
          )}
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
            disabled={
              loading ||
              formData.generalImages.length === 0 ||
              Object.keys(formData.sportImages).length === 0
            }
            className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
          >
            Continue to Documents
          </Button>
        </div>
      </div>
    </Card>
  );
}
