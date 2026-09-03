import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { VenueFormData } from "@/modules/admin/utils/venueFormHelpers";
import { Loader2 } from "lucide-react";

interface AddVenueStep5Props {
  loading: boolean;
  formData: VenueFormData;
  samePriceForAll: boolean;
  basePricePerHour: string;
  onBack: () => void;
  onPublish: () => void;
}

export function AddVenueStep5({
  loading,
  formData,
  samePriceForAll,
  basePricePerHour,
  onBack,
  onPublish,
}: AddVenueStep5Props) {
  return (
    <Card className="shadow-xs rounded-2xl border border-slate-200 bg-white/90">
      <div className="space-y-6 p-6 md:p-8">
        <OnboardingSectionCard title="Review" subtitle="Check everything before publishing">
          <div className="grid gap-4 text-sm text-slate-700 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Venue</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formData.name || "Untitled venue"}
              </p>
              <p className="mt-2 text-slate-600">{formData.address}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pricing</p>
              <p className="mt-1 font-semibold text-slate-900">
                {samePriceForAll ? `₹${basePricePerHour || 0} / hour` : "Sport-specific pricing"}
              </p>
              <p className="mt-2 text-slate-600">{formData.sports.length} sports selected</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Amenities</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formData.amenities.length || 0} selected
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Photos</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formData.generalImages.length} general,{" "}
                {Object.values(formData.sportImages).flat().length} sport images
              </p>
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
            onClick={onPublish}
            disabled={loading}
            className="bg-power-orange flex items-center gap-2 px-6 text-white hover:bg-orange-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish Venue"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
