"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Filter, Loader2, Building2, ChevronDown } from "lucide-react";
import { toast } from "@/lib/toast";
import axiosInstance from "@/lib/api/axios";
import { reviewApi } from "@/modules/review/services/review";
import {
  StarDisplay,
  ReviewCard,
  ReviewSummaryCard,
} from "@/modules/shared/components/dashboard/reviews";
import type { ReviewItem, ReviewSummary, Venue } from "@/types";

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
        const res = await reviewApi.getVenueReviews(
          venueId,
          pageNum,
          PAGE_LIMIT,
        );
        if (res.success && res.data) {
          const { reviews: fetched, summary: fetchedSummary } = res.data;
          if (append) {
            setAllReviews((prev) => [...prev, ...fetched]);
          } else {
            setAllReviews(fetched);
            setSummary(fetchedSummary);
          }
          // Determine if there are more pages
          const total =
            res.pagination?.total ?? fetchedSummary.reviewCount ?? 0;
          const loaded = append
            ? allReviews.length + fetched.length
            : fetched.length;
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
    [allReviews.length],
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Page Header ── */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Reviews &amp; Ratings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            See what players are saying about your venues.
          </p>
        </div>

        {/* ── Venues Loading ── */}
        {venuesLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-power-orange animate-spin" />
          </div>
        )}

        {/* ── No Venues Empty State ── */}
        {!venuesLoading && venues.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-700 text-lg">
                No venues yet
              </p>
              <p className="text-sm text-slate-500 mt-1">
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
              <div className="relative inline-flex items-center w-full sm:w-auto">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={selectedVenueId}
                  onChange={handleVenueChange}
                  className="appearance-none w-full sm:w-72 pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 cursor-pointer transition"
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
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* ── Single venue label ── */}
            {venues.length === 1 && selectedVenueName && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-100">
                <Building2 className="w-3.5 h-3.5 text-power-orange" />
                <span className="text-xs font-medium text-orange-700">
                  {selectedVenueName}
                </span>
              </div>
            )}

            {/* ── Reviews Loading ── */}
            {reviewsLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-power-orange animate-spin" />
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 text-xs text-slate-400 font-medium mr-1">
                      <Filter className="w-3.5 h-3.5" />
                      Filter
                    </div>
                    {FILTER_TABS.map((tab) => {
                      const isActive = activeFilter === tab.value;
                      return (
                        <button
                          key={tab.label}
                          onClick={() => setActiveFilter(tab.value)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            isActive
                              ? "bg-power-orange border-power-orange text-white shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600"
                          }`}
                        >
                          {tab.value !== null && (
                            <Star
                              className={`w-3 h-3 ${isActive ? "text-white" : "text-orange-400"}`}
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
                    className="flex flex-col items-center justify-center py-16 gap-3 text-center"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                      <Star className="w-7 h-7 text-slate-300" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-600">
                        No reviews yet
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        Reviews will appear here once players complete bookings
                        at this venue.
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
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-orange-300 hover:text-orange-600 transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
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
