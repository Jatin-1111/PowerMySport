"use client";

import React from "react";
import { Star, ThumbsUp, User } from "lucide-react";
import type { ReviewItem, ReviewSummary } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReviewerName(
  userId: string | { name?: string; _id?: string; id?: string },
): string {
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

export function StarDisplay({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}) {
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
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-white text-sm font-semibold select-none">
          {initials || <User size={16} />}
        </div>

        {/* Name, date, stars */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800 text-sm truncate">
              {name}
            </span>
            {isVerified && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <StarDisplay rating={review.rating} size={13} />
            <span className="text-xs text-slate-400">
              {formatDate(review.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Review text */}
      {review.review && (
        <p className="mt-3 text-sm italic text-slate-600 leading-relaxed">
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
    <div className="bg-white rounded-2xl p-6 border border-slate-200">
      <div className="flex flex-col sm:flex-row items-center gap-8">
        {/* Left: big rating */}
        <div className="flex flex-col items-center flex-shrink-0">
          <span className="text-5xl font-bold text-slate-900 leading-none">
            {summary.averageRating.toFixed(1)}
          </span>
          <div className="mt-2">
            <StarDisplay rating={summary.averageRating} size={18} />
          </div>
          <span className="mt-1.5 text-sm text-slate-500">
            {summary.reviewCount}{" "}
            {summary.reviewCount === 1 ? "review" : "reviews"}
          </span>
        </div>

        {/* Right: star distribution */}
        <div className="flex-1 w-full space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const barColor = STAR_COLORS[star];
            return (
              <div key={star} className="flex items-center gap-2">
                {/* Star label */}
                <div className="flex items-center gap-0.5 w-10 flex-shrink-0 justify-end">
                  <span className="text-xs text-slate-500 font-medium">
                    {star}
                  </span>
                  <Star
                    width={11}
                    height={11}
                    className="text-orange-400"
                    style={{ fill: "currentColor" }}
                  />
                </div>

                {/* Track + fill */}
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Count */}
                <span className="w-5 text-right text-xs text-slate-400 flex-shrink-0">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
