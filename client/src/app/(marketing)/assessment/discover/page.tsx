"use client";

import { WizardShell } from "@/modules/find-sport/components/WizardShell";
import { Suspense } from "react";

export default function AssessmentDiscoverPage() {
  // Suspense boundary: WizardShell reads its step from the URL via
  // useSearchParams, which must be wrapped.
  return (
    <Suspense fallback={null}>
      <WizardShell />
    </Suspense>
  );
}
