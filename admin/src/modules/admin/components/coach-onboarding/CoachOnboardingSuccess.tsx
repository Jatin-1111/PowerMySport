import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { useRouter } from "next/navigation";

export function CoachOnboardingSuccess({
  successCoachId,
  successCoachLink,
}: {
  successCoachId: string;
  successCoachLink: string;
}) {
  const router = useRouter();

  return (
    <Card className="bg-linear-to-br border border-emerald-200 from-white to-emerald-50 p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Onboarding complete
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Coach account created and activated
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            The coach profile is live and ready for admin review.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-700">
          <p>
            Coach ID: <span className="font-semibold text-slate-900">{successCoachId}</span>
          </p>
          <p className="mt-1">
            Profile link: <span className="font-semibold text-slate-900">{successCoachLink}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="primary" onClick={() => router.push(successCoachLink)}>
            Open coach review
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/admin/coaches")}>
            Back to coaches
          </Button>
        </div>
      </div>
    </Card>
  );
}
