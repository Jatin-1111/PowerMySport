"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Filter, Loader2, Star, ThumbsUp, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { reviewApi } from "@/modules/review/services/review";
import {
  StaggerContainer,
  StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { Coach, ReviewItem, ReviewListData, ReviewSummary } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getReviewerName(userId: ReviewItem["userId"]): string {
  if (typeof userId === "object" && userId !== null) {
    return (userId as { name?: string }).name ?? "Anonymous";
  }
  return "Anonymous";
}

// ---------------------------------------------------------------------------
// Star rendering
// ---------------------------------------------------------------------------

interface StarRowProps {
  rating: number;
  size?: number;
  className?: string;
}

function StarRow({ rating, size = 16, className = "" }: StarRowProps) {
  return (
    <span className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = rating >= n;
        const half = !filled && rating >= n - 0.5;
        return (
          <span key={n} className="relative" style={{ width: size, height: size }}>
            {/* Background star (empty) */}
            <Star
              size={size}
              className="absolute inset-0 text-slate-200"
              fill="currentColor"
            />
            {/* Foreground star (filled or half) */}
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: filled ? "100%" : half ? "50%" : "0%" }}
            >
              <Star
                size={size}
                className="text-power-orange"
                fill="currentColor"
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Rating distribution bar colours
// ---------------------------------------------------------------------------

const STAR_COLORS: Record<number, string> = {
  5: "bg-turf-green",
  4: "bg-turf-green",
  3: "bg-amber-400",
  2: "bg-power-orange",
  1: "bg-rose-500",
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

const LIMIT = 10;

type FilterTab = "all" | 1 | 2 | 3 | 4 | 5;

export default function CoachReviewsPage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [allReviews, setAllReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 1. Fetch coach profile ────────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await coachApi.getMyProfile();
        if (res.success && res.data) {
          setCoach(res.data as Coach);
        } else {
          setError("Failed to load coach profile.");
        }
      } catch {
        setError("Failed to load coach profile.");
        toast.error("Could not load your profile.");
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  // ── 2. Fetch reviews whenever coach id changes ────────────────────────────
  const fetchReviews = useCallback(
    async (coachId: string, pageNum: number, append: boolean) => {
      try {
        append ? setLoadingMore(true) : setLoadingReviews(true);
        const res = await reviewApi.getCoachReviews(coachId, pageNum, LIMIT);
        if (res.success && res.data) {
          const data: ReviewListData = res.data;
          setAllReviews((prev) =>
            append ? [...prev, ...data.reviews] : data.reviews,
          );
          setSummary(data.summary);
          // Derive totalPages from pagination metadata if provided
          const pagination = (res as { pagination?: { totalPages?: number } })
            .pagination;
          setTotalPages(pagination?.totalPages ?? 1);
        } else {
          toast.error("Could not load reviews.");
        }
      } catch {
        toast.error("Could not load reviews.");
      } finally {
        setLoadingMore(false);
        setLoadingReviews(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!coach?.id) return;
    setPage(1);
    fetchReviews(coach.id, 1, false);
  }, [coach?.id, fetchReviews]);

  // ── 3. Load more ──────────────────────────────────────────────────────────
  const handleLoadMore = () => {
    if (!coach?.id || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReviews(coach.id, nextPage, true);
  };

  // ── 4. Local filter ───────────────────────────────────────────────────────
  const filteredReviews = useMemo(() => {
    if (activeFilter === "all") return allReviews;
    return allReviews.filter((r) => Math.round(r.rating) === activeFilter);
  }, [allReviews, activeFilter]);

  // ── 5. Rating distribution ────────────────────────────────────────────────
  const distribution = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    allReviews.forEach((r) => {
      const rounded = Math.min(5, Math.max(1, Math.round(r.rating)));
      counts[rounded] = (counts[rounded] ?? 0) + 1;
    });
    return counts;
  }, [allReviews]);

  const totalReviewsLoaded = allReviews.length;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loadingProfile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-power-orange" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-slate-500">{error}</p>
      </div>
    );
  }

  const avgRating = summary?.averageRating ?? 0;
  const reviewCount = summary?.reviewCount ?? 0;
  const hasMore = page < totalPages;

  const filterTabs: { label: string; value: FilterTab }[] = [
    { label: "All", value: "all" },
    { label: "5★", value: 5 },
    { label: "4★", value: 4 },
    { label: "3★", value: 3 },
    { label: "2★", value: 2 },
    { label: "1★", value: 1 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Page Header ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Reviews &amp; Ratings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            See what your clients are saying about your coaching.
          </p>
        </motion.div>

        {/* ── Rating Summary Card ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
            {/* Left — big number */}
            <div className="flex flex-col items-center justify-center gap-2 sm:min-w-[160px]">
              <span className="text-6xl font-extrabold tracking-tight text-slate-900">
                {avgRating > 0 ? avgRating.toFixed(1) : "—"}
              </span>
              <StarRow rating={avgRating} size={22} />
              <span className="text-sm text-slate-400">
                {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            </div>

            {/* Divider */}
            <div className="hidden h-28 w-px bg-slate-100 sm:block" />
            <hr className="sm:hidden" />

            {/* Right — distribution bars */}
            <div className="flex flex-1 flex-col gap-2.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = distribution[star] ?? 0;
                const pct =
                  totalReviewsLoaded > 0
                    ? (count / totalReviewsLoaded) * 100
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs font-semibold text-slate-500">
                      {star}
                    </span>
                    <Star
                      size={13}
                      className="shrink-0 text-orange-400"
                      fill="currentColor"
                    />
                    <div className="flex-1 rounded-full bg-slate-100">
                      <motion.div
                        className={`h-2 rounded-full ${STAR_COLORS[star]}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                      />
                    </div>
                    <span className="w-6 text-xs text-slate-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ── Filter Tabs ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          <Filter size={15} className="text-slate-400" />
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                activeFilter === tab.value
                  ? "bg-power-orange text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-orange-50 hover:text-orange-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* ── Review List ──────────────────────────────────────── */}
        {loadingReviews ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-power-orange" />
          </div>
        ) : filteredReviews.length === 0 ? (
          <EmptyState activeFilter={activeFilter} />
        ) : (
          <StaggerContainer className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {filteredReviews.map((review) => (
                <StaggerItem key={review._id ?? review.id}>
                  <ReviewCard review={review} />
                </StaggerItem>
              ))}
            </AnimatePresence>
          </StaggerContainer>
        )}

        {/* ── Load More ────────────────────────────────────────── */}
        {hasMore && activeFilter === "all" && !loadingReviews && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore && (
                <Loader2 size={15} className="animate-spin text-power-orange" />
              )}
              {loadingMore ? "Loading…" : "Load more reviews"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ReviewCard({ review }: { review: ReviewItem }) {
  const name = getReviewerName(review.userId);
  const initials = getInitials(name);
  const avatarColors = [
    "bg-indigo-100 text-indigo-700",
    "bg-sky-100 text-sky-700",
    "bg-teal-100 text-teal-700",
    "bg-rose-100 text-rose-700",
    "bg-amber-100 text-amber-700",
  ];
  // Deterministic colour based on name
  const colorClass =
    avatarColors[
      name.charCodeAt(0) % avatarColors.length
    ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${colorClass}`}
        >
          {initials || <User size={18} />}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">{name}</span>
            {/* Verified badge placeholder — ReviewItem has no isVerified field; keeping for UI completeness */}
            {(review as ReviewItem & { isVerified?: boolean }).isVerified && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 ring-1 ring-emerald-200">
                Verified
              </span>
            )}
            <span className="ml-auto text-xs text-slate-400">
              {formatReviewDate(review.createdAt)}
            </span>
          </div>

          {/* Stars */}
          <div className="mt-1">
            <StarRow rating={review.rating} size={14} />
          </div>

          {/* Review text */}
          {review.review && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {review.review}
            </p>
          )}

          {/* Helpful count */}
          {(review as ReviewItem & { helpfulCount?: number }).helpfulCount !==
            undefined && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <ThumbsUp size={13} />
              <span>
                {(review as ReviewItem & { helpfulCount?: number }).helpfulCount}{" "}
                helpful
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ activeFilter }: { activeFilter: FilterTab }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
        <Star size={26} className="text-slate-300" />
      </div>
      <div>
        <p className="font-semibold text-slate-700">
          {activeFilter === "all"
            ? "No reviews yet"
            : `No ${activeFilter}-star reviews`}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {activeFilter === "all"
            ? "Complete sessions to start earning reviews from your clients."
            : "Try a different filter to see other reviews."}
        </p>
      </div>
    </motion.div>
  );
}
