"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { sportsApi } from "@/modules/sports/services/sports";
import { Venue } from "@/types";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function VenuesPage() {
  const [loading, setLoading] = useState(true);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [filteredVenues, setFilteredVenues] = useState<Venue[]>([]);
  const [sportInput, setSportInput] = useState("");
  const [appliedSportFilter, setAppliedSportFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVenues, setTotalVenues] = useState(0);
  const router = useRouter();

  useEffect(() => {
    loadVenues(currentPage, appliedSportFilter);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, appliedSportFilter]);

  useEffect(() => {
    loadSportOptions();
  }, []);

  useEffect(() => {
    applyVenueFilters(venues);
  }, [venues, minPrice, maxPrice, minRating, sortBy]);

  const loadSportOptions = async () => {
    try {
      const sports = await sportsApi.getAllSports();
      const names = sports
        .map((sport) => sport.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      setSportOptions(names);
    } catch {
      setSportOptions([]);
    }
  };

  const loadVenues = async (page: number = 1, sportFilter: string = "") => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
        include: "venues",
      };

      if (sportFilter) {
        params.sport = sportFilter;
      }

      const response = await discoveryApi.searchNearbyVenues(params);
      if (response.success && response.data) {
        setVenues(response.data.venues || []);
        if (response.pagination?.venues) {
          setTotalPages(response.pagination.venues.totalPages);
          setTotalVenues(response.pagination.venues.total);
        }
      }
    } catch (error) {
      console.error("Failed to load venues:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyVenueFilters = (baseVenues: Venue[]) => {
    const parsedMinPrice = minPrice ? Number(minPrice) : undefined;
    const parsedMaxPrice = maxPrice ? Number(maxPrice) : undefined;
    const parsedMinRating = Number(minRating || 0);

    let next = baseVenues.filter((venue) => {
      const price = getDisplayPrice(venue);
      const rating = venue.rating || 0;

      if (parsedMinPrice !== undefined && !Number.isNaN(parsedMinPrice)) {
        if (price < parsedMinPrice) return false;
      }

      if (parsedMaxPrice !== undefined && !Number.isNaN(parsedMaxPrice)) {
        if (price > parsedMaxPrice) return false;
      }

      if (rating < parsedMinRating) {
        return false;
      }

      return true;
    });

    if (sortBy === "priceAsc") {
      next = [...next].sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
    } else if (sortBy === "priceDesc") {
      next = [...next].sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
    } else if (sortBy === "ratingDesc") {
      next = [...next].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    setFilteredVenues(next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSportFilter(sportInput.trim());
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSportInput("");
    setAppliedSportFilter("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("0");
    setSortBy("relevance");
    setCurrentPage(1);
  };

  const getDisplayPrice = (venue: Venue) => {
    if (venue.sportPricing) {
      const values = Object.values(venue.sportPricing).filter(
        (value) => typeof value === "number" && value >= 0,
      );
      if (values.length > 0) {
        return Math.min(...values);
      }
    }
    return venue.pricePerHour;
  };

  const activeVenueFilters = [
    appliedSportFilter ? `Sport: ${appliedSportFilter}` : null,
    minPrice ? `Min ₹${minPrice}` : null,
    maxPrice ? `Max ₹${maxPrice}` : null,
    Number(minRating) > 0 ? `Rating ${minRating}+` : null,
    sortBy !== "relevance"
      ? sortBy === "priceAsc"
        ? "Sort: Price Low-High"
        : sortBy === "priceDesc"
          ? "Sort: Price High-Low"
          : "Sort: Top Rated"
      : null,
  ].filter(Boolean) as string[];

  const hasActiveVenueFilters = activeVenueFilters.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <Navigation variant="dark" sticky />
      <main className="flex-1">
        {/* Header Section */}
        <div className="bg-white/70 border-b border-white/60 backdrop-blur-md">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#f8fbff_0%,#e5f1ff_38%,#fff4e2_100%)] p-6 text-slate-900 shadow-sm sm:p-8">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 size={32} className="text-power-orange" />
                  <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Sports Venues
                  </span>
                </div>
                <h1 className="font-title text-3xl sm:text-4xl font-bold mb-3">
                  Discover Premium Venues
                </h1>
                <p className="text-slate-700 text-base sm:text-lg mb-6 max-w-2xl">
                  Browse and book from our collection of top-rated sports
                  venues. Find the perfect space for your next game.
                </p>

                {/* Search Bar */}
                <form
                  onSubmit={handleSearch}
                  className="flex flex-col sm:flex-row gap-3 max-w-2xl"
                >
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      size={20}
                    />
                    <input
                      type="text"
                      value={sportInput}
                      onChange={(e) => setSportInput(e.target.value)}
                      placeholder="Search by sport (e.g. Cricket, Tennis, Basketball)..."
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-power-orange/50 focus:border-power-orange bg-white text-slate-900 font-medium"
                      aria-label="Search venues by sport"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full rounded-xl px-8 premium-shadow sm:w-auto sm:whitespace-nowrap"
                  >
                    <Search size={18} className="mr-2" />
                    Apply Sport
                  </Button>
                </form>

                <div className="mt-5 max-w-6xl rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-md">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Refine Results
                    </p>
                    {hasActiveVenueFilters && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleClearFilters}
                        className="text-xs px-3 py-1.5"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Sport
                      </span>
                      <select
                        value={sportInput}
                        onChange={(e) => setSportInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      >
                        <option value="">All Sports</option>
                        {sportOptions.map((sport) => (
                          <option key={sport} value={sport}>
                            {sport}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Min Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Max Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="e.g. 2500"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Minimum Rating
                      </span>
                      <select
                        value={minRating}
                        onChange={(e) => setMinRating(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      >
                        <option value="0">Any Rating</option>
                        <option value="3">3+ and above</option>
                        <option value="4">4+ and above</option>
                        <option value="4.5">4.5+ and above</option>
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Sort By
                      </span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="priceAsc">Price: Low to High</option>
                        <option value="priceDesc">Price: High to Low</option>
                        <option value="ratingDesc">Rating: High to Low</option>
                      </select>
                    </label>
                  </div>

                  {hasActiveVenueFilters && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeVenueFilters.map((filter) => (
                        <span
                          key={filter}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {filter}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-turf-green/20 blur-3xl" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading venues...</p>
            </div>
          ) : filteredVenues.length === 0 ? (
            <Card className="shop-surface premium-shadow">
              <div className="text-center py-16 bg-white/70 rounded-xl">
                <Building2 size={56} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {appliedSportFilter
                    ? "No venues found"
                    : "No venues available"}
                </h3>
                <p className="text-slate-500 mb-6">
                  {appliedSportFilter
                    ? `We couldn't find any venues for "${appliedSportFilter}". Try a different sport.`
                    : "Check back soon for new venues."}
                </p>
                {appliedSportFilter && (
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Clear Search
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <>
              {/* Results Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-title text-2xl font-bold text-slate-900">
                    {appliedSportFilter
                      ? `${appliedSportFilter} Venues`
                      : "All Venues"}
                  </h2>
                  <p className="text-slate-600 mt-1">
                    {filteredVenues.length} venue
                    {filteredVenues.length !== 1 ? "s" : ""} available
                  </p>
                </div>
              </div>

              {/* Venues Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredVenues.map((venue) => (
                  <Card
                    key={venue.id}
                    className="shop-surface premium-shadow hover:-translate-y-1 hover:shadow-lg transition-all duration-200 overflow-hidden group cursor-pointer"
                    onClick={() =>
                      router.push(`/venues/${venue.id || venue._id}`)
                    }
                  >
                    {venue.images && venue.images.length > 0 ? (
                      <div className="h-48 w-full overflow-hidden bg-slate-100">
                        <img
                          src={venue.images[0]}
                          alt={venue.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="h-48 w-full bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Building2 size={48} className="text-slate-300" />
                      </div>
                    )}

                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-bold text-slate-900 flex-1">
                          {venue.name}
                        </h3>
                        {venue.rating && venue.rating > 0 && (
                          <div className="flex items-center gap-1 ml-2">
                            <Star
                              size={16}
                              className="text-yellow-500 fill-yellow-500"
                            />
                            <span className="text-sm font-semibold text-slate-700">
                              {venue.rating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 mb-4">
                        {venue.address ? (
                          <p className="text-sm text-slate-600 flex items-start gap-2">
                            <MapPin
                              size={16}
                              className="text-power-orange shrink-0 mt-0.5"
                            />
                            <span className="line-clamp-2">
                              {venue.address}
                            </span>
                          </p>
                        ) : venue.location ? (
                          <p className="text-sm text-slate-600 flex items-center gap-2">
                            <MapPin
                              size={16}
                              className="text-power-orange shrink-0"
                            />
                            {venue.location.coordinates[1].toFixed(3)}°N,{" "}
                            {venue.location.coordinates[0].toFixed(3)}°E
                          </p>
                        ) : null}
                      </div>

                      {/* Sports Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {venue.sports.slice(0, 3).map((sport, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium"
                          >
                            {sport}
                          </span>
                        ))}
                        {venue.sports.length > 3 && (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                            +{venue.sports.length - 3} more
                          </span>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                              Starting from
                            </p>
                            <p className="text-xl font-bold text-power-orange flex items-center gap-1 mt-0.5">
                              <IndianRupee size={18} />
                              {getDisplayPrice(venue)}
                              <span className="text-sm text-slate-500 font-normal">
                                /hr
                              </span>
                            </p>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            className="group-hover:shadow-lg transition-shadow"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/venues/${venue.id || venue._id}`);
                            }}
                          >
                            Book
                            <ArrowRight size={16} className="ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPage === 1 || loading}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={loading}
                          className={`min-w-10 h-10 px-3 rounded-lg font-medium transition-all ${
                            currentPage === pageNum
                              ? "bg-power-orange text-white shadow-md"
                              : "bg-white text-slate-700 border border-slate-300 hover:border-power-orange hover:text-power-orange"
                          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPage === totalPages || loading}
                    className="flex items-center gap-1"
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                </div>
              )}

              {/* Results Summary */}
              <div className="mt-4 text-center text-sm text-slate-600">
                Showing {(currentPage - 1) * 20 + 1} -{" "}
                {Math.min(currentPage * 20, totalVenues)} of {totalVenues}{" "}
                venues
              </div>
            </>
          )}
        </div>
      </main>
      {/* Footer */}
      <Footer />
    </div>
  );
}
