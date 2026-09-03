import { AcademyOnboardingContainer } from "@/modules/onboarding/components/academy";
import { Suspense } from "react";

export const metadata = {
  title: "Academy Onboarding",
  description: "Set up your academy profile, operations, pricing, and payouts.",
};

export default function AcademyOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="bg-power-orange/20 mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full">
              <div className="border-power-orange border-3 h-8 w-8 animate-spin rounded-full border-t-transparent" />
            </div>
            <p className="text-slate-600">Loading onboarding...</p>
          </div>
        </div>
      }
    >
      <AcademyOnboardingContainer />
    </Suspense>
  );
}
