"use client";

import type { ReviewItem, ReviewSummary } from "@/types";
import { Star, ThumbsUp, User } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReviewerName(userId: string | { name?: string; _id?: string; id?: string }): string {
  if (typeof userId === "string") return "User";
  return userId.name ?? "User";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// 1. StarDisplay
// ---------------------------------------------------------------------------

export function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = rating >= i;
        return (
          <Star
            key={i}
            width={size}
            height={size}
            className={filled ? "text-orange-400" : "text-slate-300"}
            style={{ fill: filled ? "currentColor" : "none" }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. ReviewCard
// ---------------------------------------------------------------------------

export function ReviewCard({ review }: { review: ReviewItem }) {
  const name = getReviewerName(review.userId);
  const initials = getInitials(name);
  const isVerified = Boolean(review.bookingId);
  const helpfulCount =
    "helpfulCount" in review
      ? (review as ReviewItem & { helpfulCount?: number }).helpfulCount
      : undefined;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-400 text-sm font-semibold text-white select-none">
          {initials || <User size={16} />}
        </div>

        {/* Name, date, stars */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-800">{name}</span>
            {isVerified && (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Verified
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StarDisplay rating={review.rating} size={13} />
            <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Review text */}
      {review.review && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600 italic">
          &ldquo;{review.review}&rdquo;
        </p>
      )}

      {/* Helpful count */}
      {typeof helpfulCount === "number" && helpfulCount > 0 && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
          <ThumbsUp size={12} />
          <span>{helpfulCount} found this helpful</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. ReviewSummaryCard
// ---------------------------------------------------------------------------

const STAR_COLORS: Record<number, string> = {
  5: "bg-turf-green",
  4: "bg-turf-green",
  3: "bg-amber-400",
  2: "bg-orange-400",
  1: "bg-rose-400",
};

export function ReviewSummaryCard({
  summary,
  reviews,
}: {
  summary: ReviewSummary;
  reviews: ReviewItem[];
}) {
  // Build distribution counts
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    const rounded = Math.round(r.rating);
    if (rounded >= 1 && rounded <= 5) {
      distribution[rounded] = (distribution[rounded] ?? 0) + 1;
    }
  }

  const total = summary.reviewCount || reviews.length || 1;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col items-center gap-8 sm:flex-row">
        {/* Left: big rating */}
        <div className="flex flex-shrink-0 flex-col items-center">
          <span className="text-5xl leading-none font-bold text-slate-900">
            {summary.averageRating.toFixed(1)}
          </span>
          <div className="mt-2">
            <StarDisplay rating={summary.averageRating} size={18} />
          </div>
          <span className="mt-1.5 text-sm text-slate-500">
            {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}
          </span>
        </div>

        {/* Right: star distribution */}
        <div className="w-full flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const barColor = STAR_COLORS[star];
            return (
              <div key={star} className="flex items-center gap-2">
                {/* Star label */}
                <div className="flex w-10 flex-shrink-0 items-center justify-end gap-0.5">
                  <span className="text-xs font-medium text-slate-500">{star}</span>
                  <Star
                    width={11}
                    height={11}
                    className="text-orange-400"
                    style={{ fill: "currentColor" }}
                  />
                </div>

                {/* Track + fill */}
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Count */}
                <span className="w-5 flex-shrink-0 text-right text-xs text-slate-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
