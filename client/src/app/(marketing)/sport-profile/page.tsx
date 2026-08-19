"use client";

import { SportKnownFlow } from "@/modules/find-sport/components/SportKnownFlow";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

export default function SportProfilePage() {
  const router = useRouter();
  // Suspense boundary: SportKnownFlow reads the step from the URL via
  // useSearchParams, which must be wrapped.
  return (
    <Suspense fallback={null}>
      <SportKnownFlow onBack={() => router.push("/assessment")} />
    </Suspense>
  );
}
