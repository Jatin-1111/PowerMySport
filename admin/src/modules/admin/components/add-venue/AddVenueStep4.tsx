import OnboardingSectionCard from "@/modules/onboarding/components/OnboardingSectionCard";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";

export function AddVenueStep4({
  loading,
  onBack,
  onContinue,
}: {
  loading: boolean;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <Card className="shadow-xs rounded-2xl border border-slate-200 bg-white/90">
      <div className="space-y-6 p-6 md:p-8">
        <OnboardingSectionCard
          title="Documents"
          subtitle="No document upload is required for admin-created venues"
        >
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-slate-700">
            <p className="font-medium text-emerald-900">Frictionless admin flow</p>
            <p className="mt-2 text-sm leading-6">
              Venue documents are required only in the public onboarding flow. Admin-created venues
              can be published without any document upload.
            </p>
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
            Continue to Review
          </Button>
        </div>
      </div>
    </Card>
  );
}
