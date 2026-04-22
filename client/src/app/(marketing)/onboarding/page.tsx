"use client";

import dynamic from "next/dynamic";

const OnboardingContainer = dynamic(
  () =>
    import("@/modules/onboarding/components/onboarding").then(
      (mod) => mod.OnboardingContainer,
    ),
  {
    ssr: false,
    loading: () => <OnboardingPageSkeleton />,
  },
);

function OnboardingPageSkeleton() {
  return (
    <div className="min-h-screen py-10 md:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mx-auto h-10 w-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="mx-auto mt-3 h-5 w-80 animate-pulse rounded-lg bg-slate-100" />
        </div>

        <div className="mx-auto mb-8 max-w-4xl rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-xs">
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`sk-step-${index}`} className="text-center">
                <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-slate-200" />
                <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
        </div>

        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-xs">
          <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 space-y-4">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-power-orange/25" />
        </div>
      </div>
    </div>
  );
}

export default function PublicOnboardingPage() {
  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-linear-to-br from-orange-50 via-white to-slate-100" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-20 h-72 w-72 rounded-full bg-power-orange/20 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-slate-200/40 blur-3xl" />
      </div>

      <div className="relative z-10 pb-8">
        <OnboardingContainer />
      </div>
    </div>
  );
}
