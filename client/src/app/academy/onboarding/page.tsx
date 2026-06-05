import React, { Suspense } from "react";
import { AcademyOnboardingContainer } from "@/modules/onboarding/components/academy";

export const metadata = {
  title: "Academy Onboarding - PowerMySport",
  description: "Set up your academy profile, operations, pricing, and payouts.",
};

export default function AcademyOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-power-orange/20 mb-4">
              <div className="w-8 h-8 border-3 border-power-orange border-t-transparent rounded-full animate-spin" />
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
