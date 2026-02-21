"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
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
  const [sportFilter, setSportFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVenues, setTotalVenues] = useState(0);
  const router = useRouter();

  useEffect(() => {
    loadVenues(currentPage);
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, sportFilter]);

  const loadVenues = async (page: number = 1) => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
      };

      if (sportFilter) {
        params.sport = sportFilter;
      }

      const response = await discoveryApi.searchNearby(params);
      if (response.success && response.data) {
        setVenues(response.data.venues);
        setFilteredVenues(response.data.venues);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to page 1 when searching
    loadVenues(1);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation */}
      <Navigation variant="dark" sticky />
      <main className="flex-1">
        {/* Header Section */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 size={32} className="text-power-orange" />
                  <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                    Sports Venues
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                  Discover Premium Venues
                </h1>
                <p className="text-slate-200 text-base sm:text-lg mb-6 max-w-2xl">
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
                      value={sportFilter}
                      onChange={(e) => setSportFilter(e.target.value)}
                      placeholder="Search by sport (e.g. Cricket, Tennis, Basketball)..."
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange/50 focus:border-power-orange bg-white text-slate-900 font-medium"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="whitespace-nowrap px-8 shadow-lg"
                  >
                    <Search size={18} className="mr-2" />
                    Search
                  </Button>
                </form>
              </div>
              <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-turf-green/20 blur-3xl" />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading venues...</p>
            </div>
          ) : filteredVenues.length === 0 ? (
            <Card className="bg-white">
              <div className="text-center py-16 bg-slate-50 rounded-lg">
                <Building2 size={56} className="mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {sportFilter ? "No venues found" : "No venues available"}
                </h3>
                <p className="text-slate-500 mb-6">
                  {sportFilter
                    ? `We couldn't find any venues for "${sportFilter}". Try a different sport.`
                    : "Check back soon for new venues."}
                </p>
                {sportFilter && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSportFilter("");
                      setCurrentPage(1);
                    }}
                  >
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
                  <h2 className="text-2xl font-bold text-slate-900">
                    {sportFilter ? `${sportFilter} Venues` : "All Venues"}
                  </h2>
                  <p className="text-slate-600 mt-1">
                    {filteredVenues.length} venue
                    {filteredVenues.length !== 1 ? "s" : ""} available
                  </p>
                </div>
              </div>

              {/* Venues Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVenues.map((venue) => (
                  <Card
                    key={venue.id}
                    className="bg-white border-2 border-slate-100 hover:border-power-orange hover:shadow-xl transition-all overflow-hidden group cursor-pointer"
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
                          className={`min-w-[40px] h-10 px-3 rounded-lg font-medium transition-all ${
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
