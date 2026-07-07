"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Building2, Loader2, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import {
  ReviewCard,
  ReviewSummaryCard,
  StarDisplay,
} from "@/modules/shared/components/dashboard/reviews";
import { reviewApi } from "@/modules/review/services/review";
import type { ReviewItem, ReviewSummary, Venue } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = "all" | 1 | 2 | 3 | 4 | 5;

const LIMIT = 10;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AcademyReviewsPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  const [allReviews, setAllReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const [loadingVenues, setLoadingVenues] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── 1. Fetch venues ───────────────────────────────────────────────────────
  useEffect(() => {
    const fetchVenues = async () => {
      try {
        setLoadingVenues(true);
        const res = await axiosInstance.get<{
          success: boolean;
          data?: Venue[];
        }>("/venues/my-venues");
        const list: Venue[] = res.data?.data ?? [];
        setVenues(list);
        if (list.length > 0) {
          setSelectedVenueId(list[0].id ?? list[0]._id ?? null);
        }
      } catch {
        toast.error("Could not load your venues.");
      } finally {
        setLoadingVenues(false);
      }
    };
    fetchVenues();
  }, []);

  // ── 2. Fetch reviews for selected venue ───────────────────────────────────
  const fetchReviews = useCallback(
    async (venueId: string, pageNum: number, append: boolean) => {
      try {
        append ? setLoadingMore(true) : setLoadingReviews(true);
        const res = await reviewApi.getVenueReviews(venueId, pageNum, LIMIT);
        if (res.success && res.data) {
          const { reviews, summary: sum } = res.data;
          setAllReviews((prev) => (append ? [...prev, ...reviews] : reviews));
          setSummary(sum);
          const pagination = (res as { pagination?: { totalPages?: number } })
            .pagination;
          setTotalPages(pagination?.totalPages ?? 1);
        } else {
          toast.error("Could not load reviews for this venue.");
        }
      } catch {
        toast.error("Could not load reviews for this venue.");
      } finally {
        setLoadingMore(false);
        setLoadingReviews(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedVenueId) return;
    setPage(1);
    setActiveFilter("all");
    fetchReviews(selectedVenueId, 1, false);
  }, [selectedVenueId, fetchReviews]);

  // ── 3. Filtered reviews (client-side) ────────────────────────────────────
  const filteredReviews = useMemo(() => {
    if (activeFilter === "all") return allReviews;
    return allReviews.filter((r) => Math.round(r.rating) === activeFilter);
  }, [allReviews, activeFilter]);

  // ── 4. Load more ──────────────────────────────────────────────────────────
  const handleLoadMore = () => {
    if (!selectedVenueId || loadingMore) return;
    const next = page + 1;
    setPage(next);
    fetchReviews(selectedVenueId, next, true);
  };

  const hasMore = page < totalPages;

  const filterTabs: { label: string; value: FilterTab }[] = [
    { label: "All", value: "all" },
    { label: "5★", value: 5 },
    { label: "4★", value: 4 },
    { label: "3★", value: 3 },
    { label: "2★", value: 2 },
    { label: "1★", value: 1 },
  ];

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadingVenues) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-power-orange" />
      </div>
    );
  }

  // ── No venues ─────────────────────────────────────────────────────────────
  if (venues.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="flex flex-col items-center gap-6 rounded-3xl border border-dashed border-slate-200 bg-white px-8 py-20 text-center shadow-sm"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
              <Building2 className="h-8 w-8 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                No venues linked yet
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Academy reviews are shown per venue. Link venues to your academy
                to see their reviews here.
              </p>
            </div>
            <Link
              href="/academy/venues"
              className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
            >
              <Building2 size={16} />
              Manage venues
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Full page ─────────────────────────────────────────────────────────────
  const selectedVenue = venues.find((v) => (v.id ?? v._id) === selectedVenueId);

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
            Venue Reviews
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            See what players are saying about your academy&rsquo;s venues.
          </p>
        </motion.div>

        {/* ── Venue Selector ──────────────────────────────────── */}
        {venues.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mb-6"
          >
            <label
              htmlFor="venue-select"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              Select venue
            </label>
            <div className="relative inline-block w-full max-w-sm">
              <Building2
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                id="venue-select"
                value={selectedVenueId ?? ""}
                onChange={(e) => setSelectedVenueId(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-slate-700 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                {venues.map((v) => (
                  <option key={v.id ?? v._id} value={v.id ?? v._id}>
                    {v.name}
                  </option>
                ))}
              </select>
              {/* Chevron */}
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </motion.div>
        )}

        {/* ── Summary Card ────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {summary && !loadingReviews && (
            <motion.div
              key={selectedVenueId + "-summary"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="mb-6"
            >
              <ReviewSummaryCard summary={summary} reviews={allReviews} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Single venue label (no selector shown) ──────────── */}
        {venues.length === 1 && selectedVenue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500"
          >
            <Building2 size={15} className="text-orange-400" />
            <span className="font-medium text-slate-700">
              {selectedVenue.name}
            </span>
          </motion.div>
        )}

        {/* ── Filter Tabs ──────────────────────────────────────── */}
        {!loadingReviews && allReviews.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-6 flex flex-wrap items-center gap-2"
          >
            <Star size={15} className="text-slate-300" />
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
        )}

        {/* ── Review List ──────────────────────────────────────── */}
        {loadingReviews ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-power-orange" />
          </div>
        ) : filteredReviews.length === 0 ? (
          <EmptyState activeFilter={activeFilter} />
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={selectedVenueId + "-list-" + activeFilter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4"
            >
              {filteredReviews.map((review, idx) => (
                <motion.div
                  key={review._id ?? review.id ?? idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                >
                  <ReviewCard review={review} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
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
              {loadingMore ? "Loading..." : "Load more reviews"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

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
            ? "Players will leave reviews after completing bookings at this venue."
            : "Try a different filter to see other reviews."}
        </p>
      </div>
    </motion.div>
  );
}
