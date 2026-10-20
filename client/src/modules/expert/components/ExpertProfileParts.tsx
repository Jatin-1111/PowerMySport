"use client";

import { type Expert } from "@/modules/expert/services/expert";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { Star } from "lucide-react";
import { useState } from "react";

// Presentational pieces of the public expert profile, moved out of
// app/(booking)/experts/[expertId]/ExpertDetailClient.tsx unchanged to keep that
// route file under the src/app size ratchet.

export function ExpertPortrait({ expert }: { expert: Expert }) {
  const [failed, setFailed] = useState(false);
  const initial = (expert.name || "E").charAt(0).toUpperCase();
  const frame = "aspect-[4/5] w-36 shrink-0 rounded-2xl sm:w-44";
  if (!expert.photoUrl || failed) {
    return (
      <div
        aria-hidden
        className={`${frame} bg-paper-deep text-ink-muted font-editorial flex items-center justify-center text-6xl font-light`}
      >
        {initial}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={expert.photoUrl}
      alt={expert.name || "Expert"}
      onError={() => setFailed(true)}
      className={`${frame} object-cover`}
    />
  );
}

export function RatingStars({ value }: { value: number }) {
  return (
    <span
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${Math.round(value)} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          aria-hidden
          strokeWidth={1.5}
          className={`h-3.5 w-3.5 ${i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

export function DetailSkeleton() {
  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <Skeleton className="mb-10 h-5 w-28" />
        <div className="grid gap-12 lg:grid-cols-[1fr_400px] lg:gap-16">
          <div>
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
              <Skeleton className="aspect-[4/5] w-36 rounded-2xl sm:w-44" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="mt-10 h-20 w-full" />
            <Skeleton className="mt-8 h-40 w-full" />
          </div>
          <Skeleton className="h-[28rem] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
