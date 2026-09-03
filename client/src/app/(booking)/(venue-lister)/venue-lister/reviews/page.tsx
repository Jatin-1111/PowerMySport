"use client";

import axiosInstance from "@/lib/api/axios";
import { toast } from "@/lib/toast";
import { reviewApi } from "@/modules/review/services/review";
import { ReviewCard, ReviewSummaryCard } from "@/modules/shared/components/dashboard/reviews";
import type { ReviewItem, ReviewSummary, Venue } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, Filter, Loader2, Star } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 10;

const FILTER_TABS: { label: string; value: number | null }[] = [
  { label: "All", value: null },
  { label: "5★", value: 5 },
  { label: "4★", value: 4 },
  { label: "3★", value: 3 },
  { label: "2★", value: 2 },
  { label: "1★", value: 1 },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VenueListerReviewsPage() {
  // ── Venues state ──────────────────────────────────────────────────────────
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");

  // ── Reviews state ─────────────────────────────────────────────────────────
  const [allReviews, setAllReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>({
    averageRating: 0,
    reviewCount: 0,
  });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<number | null>(null);

  // ── Fetch venues ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchVenues = async () => {
      setVenuesLoading(true);
      try {
        const res = await axiosInstance.get("/venues/my-venues");
        const data: Venue[] = res.data?.data ?? [];
        setVenues(data);
        if (data.length > 0) {
          const firstId = data[0]._id ?? data[0].id;
          setSelectedVenueId(firstId);
        }
      } catch (err) {
        console.error("Failed to fetch venues:", err);
        toast.error("Failed to load your venues.");
      } finally {
        setVenuesLoading(false);
      }
    };
    fetchVenues();
  }, []);

  // ── Fetch reviews (initial load or venue change) ──────────────────────────
  const fetchReviews = useCallback(
    async (venueId: string, pageNum: number, append = false) => {
      if (!venueId) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setReviewsLoading(true);
      }
      try {
        const res = await reviewApi.getVenueReviews(venueId, pageNum, PAGE_LIMIT);
        if (res.success && res.data) {
          const { reviews: fetched, summary: fetchedSummary } = res.data;
          if (append) {
            setAllReviews((prev) => [...prev, ...fetched]);
          } else {
            setAllReviews(fetched);
            setSummary(fetchedSummary);
          }
          // Determine if there are more pages
          const total = res.pagination?.total ?? fetchedSummary.reviewCount ?? 0;
          const loaded = append ? allReviews.length + fetched.length : fetched.length;
          setHasMore(loaded < total);
        }
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
        toast.error("Failed to load reviews.");
      } finally {
        setReviewsLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allReviews.length]
  );

  // Reset and fetch when selected venue changes
  useEffect(() => {
    if (!selectedVenueId) return;
    setAllReviews([]);
    setSummary({ averageRating: 0, reviewCount: 0 });
    setPage(1);
    setActiveFilter(null);
    fetchReviews(selectedVenueId, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenueId]);

  // ── Load more handler ─────────────────────────────────────────────────────
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchReviews(selectedVenueId, nextPage, true);
  };

  // ── Venue selector handler ────────────────────────────────────────────────
  const handleVenueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVenueId(e.target.value);
  };

  // ── Filtered reviews (client-side) ────────────────────────────────────────
  const filteredReviews = useMemo(() => {
    if (activeFilter === null) return allReviews;
    return allReviews.filter((r) => Math.round(r.rating) === activeFilter);
  }, [allReviews, activeFilter]);

  // ── Derived selected venue name ───────────────────────────────────────────
  const selectedVenueName = useMemo(() => {
    const v = venues.find((v) => (v._id ?? v.id) === selectedVenueId);
    return v?.name ?? "";
  }, [venues, selectedVenueId]);

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
        {/* ── Page Header ── */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Reviews &amp; Ratings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            See what players are saying about your venues.
          </p>
        </div>

        {/* ── Venues Loading ── */}
        {venuesLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-power-orange h-7 w-7 animate-spin" />
          </div>
        )}

        {/* ── No Venues Empty State ── */}
        {!venuesLoading && venues.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
              <Building2 className="h-8 w-8 text-orange-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-700">No venues yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Create a venue to start receiving reviews from players.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Main Content (venues exist) ── */}
        {!venuesLoading && venues.length > 0 && (
          <div className="space-y-6">
            {/* ── Venue Selector (only if multiple venues) ── */}
            {venues.length > 1 && (
              <div className="relative inline-flex w-full items-center sm:w-auto">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedVenueId}
                  onChange={handleVenueChange}
                  className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm font-medium text-slate-700 shadow-sm transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 sm:w-72"
                >
                  {venues.map((v) => {
                    const id = v._id ?? v.id;
                    return (
                      <option key={id} value={id}>
                        {v.name}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            )}

            {/* ── Single venue label ── */}
            {venues.length === 1 && selectedVenueName && (
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5">
                <Building2 className="text-power-orange h-3.5 w-3.5" />
                <span className="text-xs font-medium text-orange-700">{selectedVenueName}</span>
              </div>
            )}

            {/* ── Reviews Loading ── */}
            {reviewsLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-power-orange h-6 w-6 animate-spin" />
              </div>
            )}

            {/* ── Reviews Loaded ── */}
            {!reviewsLoading && (
              <>
                {/* Summary Card */}
                {summary.reviewCount > 0 && (
                  <ReviewSummaryCard summary={summary} reviews={allReviews} />
                )}

                {/* Filter Tabs */}
                {allReviews.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-1 flex items-center gap-1 text-xs font-medium text-slate-400">
                      <Filter className="h-3.5 w-3.5" />
                      Filter
                    </div>
                    {FILTER_TABS.map((tab) => {
                      const isActive = activeFilter === tab.value;
                      return (
                        <button
                          key={tab.label}
                          onClick={() => setActiveFilter(tab.value)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                            isActive
                              ? "bg-power-orange border-power-orange text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600"
                          }`}
                        >
                          {tab.value !== null && (
                            <Star
                              className={`h-3 w-3 ${isActive ? "text-white" : "text-orange-400"}`}
                              style={{ fill: "currentColor" }}
                            />
                          )}
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Review Cards */}
                {filteredReviews.length === 0 && allReviews.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center gap-3 py-16 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                      <Star className="h-7 w-7 text-slate-300" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-600">No reviews yet</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Reviews will appear here once players complete bookings at this venue.
                      </p>
                    </div>
                  </motion.div>
                ) : filteredReviews.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-10 text-center text-sm text-slate-400"
                  >
                    No reviews match this filter.
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {filteredReviews.map((review, index) => {
                        const key = review._id ?? review.id ?? index;
                        return (
                          <motion.div
                            key={key}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{
                              duration: 0.22,
                              delay: index * 0.04,
                            }}
                          >
                            <ReviewCard review={review} />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {/* Load More Button */}
                {hasMore && activeFilter === null && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-orange-300 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load more reviews"
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
