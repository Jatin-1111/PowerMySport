"use client";

import { ExpertOnboarding } from "@/modules/expert/components/onboarding/ExpertOnboarding";
import { Suspense } from "react";

export default function ExpertOnboardingPage() {
  // Suspense boundary for the URL-driven step (useSearchParams).
  return (
    <Suspense fallback={null}>
      <ExpertOnboarding />
    </Suspense>
  );
}
