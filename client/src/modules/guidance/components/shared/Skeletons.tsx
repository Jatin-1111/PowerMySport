"use client";

export function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />
  );
}

export function ResultSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonBlock className="h-48 w-full" />
      <div className="grid grid-cols-3 gap-3">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
      <SkeletonBlock className="h-32 w-full" />
      <SkeletonBlock className="h-32 w-full" />
    </div>
  );
}
