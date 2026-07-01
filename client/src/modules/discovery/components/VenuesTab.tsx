"use client";

import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { clientFollowStore } from "@/modules/shared/lib/followStore";
import { sportsApi } from "@/modules/sports/services/sports";
import { Venue } from "@/types";
import { getVenueImageUrls } from "@/utils/venueImages";
import { cn } from "@/utils/cn";
import {
  ArrowRight,
  Bookmark,
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  Search,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCommunityAppUrl } from "@/lib/community/url";

export default function VenuesTab() {
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
  const [followedVenueIds, setFollowedVenueIds] = useState<string[]>([]);
  const router = useRouter();

  const communityUrl = getCommunityAppUrl({
    searchParams: {
      sidebar: "inbox",
      directory: "groups",
      panel: "discover",
      q: appliedSportFilter || sportInput || undefined,
    },
  });

  useEffect(() => {
    loadVenues(currentPage, appliedSportFilter);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage, appliedSportFilter]);

  useEffect(() => { loadSportOptions(); }, []);

  useEffect(() => {
    const followed = clientFollowStore.getByKind("venue").map((item) => item.id);
    setFollowedVenueIds(followed);
  }, []);

  useEffect(() => { applyFilters(venues); }, [venues, minPrice, maxPrice, minRating, sortBy]);

  const loadSportOptions = async () => {
    try {
      const sports = await sportsApi.getAllSports();
      const names = sports.map((s) => s.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
      setSportOptions(names);
    } catch { setSportOptions([]); }
  };

  const loadVenues = async (page = 1, sportFilter = "") => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20, include: "venues" };
      if (sportFilter) params.sport = sportFilter;
      const response = await discoveryApi.searchNearbyVenues(params);
      if (response.success && response.data) {
        setVenues(response.data.venues || []);
        if (response.pagination?.venues) {
          setTotalPages(response.pagination.venues.totalPages);
          setTotalVenues(response.pagination.venues.total);
        }
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const getDisplayPrice = (venue: Venue) => {
    if (venue.sportPricing) {
      const values = Object.values(venue.sportPricing).filter((v) => typeof v === "number" && v >= 0);
      if (values.length > 0) return Math.min(...values);
    }
    return venue.pricePerHour;
  };

  const applyFilters = (base: Venue[]) => {
    const parsedMin = minPrice ? Number(minPrice) : undefined;
    const parsedMax = maxPrice ? Number(maxPrice) : undefined;
    const parsedRating = Number(minRating || 0);
    let next = base.filter((v) => {
      const price = getDisplayPrice(v);
      if (parsedMin !== undefined && !isNaN(parsedMin) && price < parsedMin) return false;
      if (parsedMax !== undefined && !isNaN(parsedMax) && price > parsedMax) return false;
      if ((v.rating || 0) < parsedRating) return false;
      return true;
    });
    if (sortBy === "priceAsc") next = [...next].sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
    else if (sortBy === "priceDesc") next = [...next].sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
    else if (sortBy === "ratingDesc") next = [...next].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    setFilteredVenues(next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSportFilter(sportInput.trim());
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSportInput(""); setAppliedSportFilter(""); setMinPrice(""); setMaxPrice(""); setMinRating("0"); setSortBy("relevance"); setCurrentPage(1);
  };

  const hasFilters = appliedSportFilter || minPrice || maxPrice || Number(minRating) > 0 || sortBy !== "relevance";

  return (
    <div className="min-h-[60vh]">
      {/* ── Compact filter bar ──────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <form onSubmit={handleSearch}>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search input */}
              <div className="relative min-w-0 flex-1 basis-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                <input
                  type="text"
                  value={sportInput}
                  onChange={(e) => setSportInput(e.target.value)}
                  placeholder="Sport or venue name…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:bg-white focus:outline-none focus:ring-1 focus:ring-power-orange/30"
                />
                {sportInput && (
                  <button type="button" onClick={() => setSportInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Sport dropdown */}
              <select
                value={sportInput}
                onChange={(e) => setSportInput(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none"
              >
                <option value="">Sport</option>
                {sportOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Price range */}
              <input
                type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min ₹"
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none"
              />
              <input
                type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max ₹"
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none"
              />

              {/* Rating */}
              <select
                value={minRating} onChange={(e) => setMinRating(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none"
              >
                <option value="0">Rating</option>
                <option value="3">3+ ★</option>
                <option value="4">4+ ★</option>
                <option value="4.5">4.5+ ★</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none"
              >
                <option value="relevance">Sort</option>
                <option value="priceAsc">Price ↑</option>
                <option value="priceDesc">Price ↓</option>
                <option value="ratingDesc">Top Rated</option>
              </select>

              {/* Actions */}
              <button
                type="submit"
                className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Search
              </button>
              {hasFilters && (
                <button type="button" onClick={handleClear} className="text-sm font-medium text-slate-500 hover:text-slate-800">
                  Clear
                </button>
              )}

              {/* Result count */}
              {!loading && (
                <span className="ml-auto text-xs font-medium text-slate-400">
                  {filteredVenues.length} venue{filteredVenues.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-100 border-t-power-orange" />
            <p className="text-sm font-medium text-slate-500">Loading venues…</p>
          </div>
        ) : filteredVenues.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
            <Building2 size={40} className="mx-auto mb-3 text-slate-200" />
            <h3 className="text-lg font-bold text-slate-900">
              {appliedSportFilter ? `No venues for "${appliedSportFilter}"` : "No venues right now"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {appliedSportFilter ? "Try a different sport or clear filters." : "We're adding venues continuously. Check back soon."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {hasFilters && <Button variant="secondary" onClick={handleClear}>Clear filters</Button>}
              <Button asChild variant="outline">
                <a href={communityUrl} target="_blank" rel="noreferrer">
                  <MessageCircle size={14} className="mr-1.5" />Ask community
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-title text-xl font-bold text-slate-900">
                {appliedSportFilter ? `${appliedSportFilter} Venues` : "All Venues"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVenues.map((venue, index) => {
                const venueId = String(venue.id || venue._id || "");
                const isFollowed = followedVenueIds.includes(venueId);
                const venueImages = getVenueImageUrls(venue);
                const knownInCommunity = Number(venue.reviewCount || 0) >= 10 ||
                  (Number(venue.rating || 0) >= 4.3 && Number(venue.reviewCount || 0) >= 5);

                const onToggleFollow = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!venueId) return;
                  clientFollowStore.toggle({ kind: "venue", id: venueId, label: venue.name, subtitle: venue.address, href: `/venues/${venueId}` });
                  setFollowedVenueIds(clientFollowStore.getByKind("venue").map((i) => i.id));
                };

                return (
                  <div
                    key={venueId || `${venue.name}-${index}`}
                    className="group cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                    onClick={() => router.push(`/venues/${venueId}`)}
                  >
                    {/* Image */}
                    <div className="relative h-56 w-full overflow-hidden bg-slate-100">
                      {venueImages.length > 0 ? (
                        <img src={venueImages[0]} alt={venue.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                          <Building2 size={44} className="text-slate-300" />
                        </div>
                      )}
                      {/* Gradient overlay for sport chip */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
                      {/* Sport chip */}
                      {venue.sports[0] && (
                        <div className="absolute bottom-3 left-3">
                          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm ring-1 ring-white/20">
                            {venue.sports[0]}
                          </span>
                        </div>
                      )}
                      {/* Bookmark button */}
                      <button
                        type="button"
                        onClick={onToggleFollow}
                        className={cn(
                          "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full shadow transition",
                          isFollowed ? "bg-power-orange text-white" : "bg-white/85 text-slate-600 backdrop-blur-sm hover:bg-white",
                        )}
                        aria-label={isFollowed ? "Unsave venue" : "Save venue"}
                      >
                        <Bookmark size={14} className={isFollowed ? "fill-current" : ""} />
                      </button>
                      {/* Rating badge */}
                      {venue.rating && venue.rating > 0 && (
                        <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-slate-800 shadow backdrop-blur-sm">
                          <Star size={11} className="fill-yellow-400 text-yellow-400" />
                          {venue.rating.toFixed(1)}
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-4">
                      <h3 className="truncate text-[15px] font-bold text-slate-900">{venue.name}</h3>

                      {(venue.address || venue.location) && (
                        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
                          <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                          <span className="line-clamp-1">
                            {venue.address || `${venue.location?.coordinates[1].toFixed(3)}°N, ${venue.location?.coordinates[0].toFixed(3)}°E`}
                          </span>
                        </p>
                      )}

                      {/* Sport tags */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {venue.sports.slice(0, 4).map((s, i) => (
                          <span key={i} className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100">{s}</span>
                        ))}
                        {venue.sports.length > 4 && (
                          <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-100">+{venue.sports.length - 4}</span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">Verified</span>
                        {knownInCommunity && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">Community known</span>
                        )}
                      </div>

                      {/* Price + CTA */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                        <div>
                          <span className="text-lg font-black text-slate-900">₹{getDisplayPrice(venue)}</span>
                          <span className="ml-1 text-xs font-medium text-slate-400">/hr</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(`/checkout?type=venue&venueId=${venueId}`); }}
                          className="flex items-center gap-1 rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                        >
                          Book <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1 || loading}>
                  <ChevronLeft size={15} /> Prev
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setCurrentPage(pageNum)} disabled={loading}
                        className={cn("h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition-all", currentPage === pageNum ? "bg-power-orange text-white shadow" : "border border-slate-200 bg-white text-slate-700 hover:border-power-orange hover:text-power-orange")}>
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading}>
                  Next <ChevronRight size={15} />
                </Button>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-slate-400">
              Showing {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, totalVenues)} of {totalVenues} venues
            </p>
          </>
        )}
      </div>
    </div>
  );
}
