"use client";

import { getCommunityAppUrl } from "@/lib/community/url";
import { ActiveFilter, FilterBar } from "@/modules/discovery/components/FilterBar";
import { SportChips } from "@/modules/discovery/components/SportChips";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { clientFollowStore } from "../../shared/store/followStore";
import { Button } from "@/modules/shared/ui/Button";
import { sportsApi } from "@/modules/sports/services/sports";
import { Venue } from "@/types";
import {
  LISTING_FALLBACK_CLASS,
  LISTING_IMAGE_CLASS,
  ListingCard,
} from "@/modules/discovery/components/ListingCard";
import { cn } from "@/utils/cn";
import { getVenueImageUrls } from "@/utils/venueImages";
import {
  Bath,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Droplets,
  Dumbbell,
  HeartPulse,
  MessageCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

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
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const AMENITIES_OPTIONS = [
    { id: "Parking", label: "Parking", icon: Car },
    { id: "Washroom", label: "Washrooms", icon: Bath },
    { id: "Drinking Water", label: "Drinking Water", icon: Droplets },
    { id: "First Aid", label: "First Aid", icon: HeartPulse },
    { id: "Cafe", label: "Cafe/Snacks", icon: Coffee },
    { id: "Equipment", label: "Equipment", icon: Dumbbell },
  ];

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

  useEffect(() => {
    loadSportOptions();
  }, []);

  useEffect(() => {
    const followed = clientFollowStore.getByKind("venue").map((item) => item.id);
    setFollowedVenueIds(followed);
  }, []);

  useEffect(() => {
    applyFilters(venues);
  }, [venues, minPrice, maxPrice, minRating, sortBy]);

  const loadSportOptions = async () => {
    try {
      const sports = await sportsApi.getAllSports();
      const names = sports
        .map((s) => s.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      setSportOptions(names);
    } catch {
      setSportOptions([]);
    }
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const getDisplayPrice = (venue: Venue) => {
    if (venue.sportPricing) {
      const values = Object.values(venue.sportPricing).filter(
        (v) => typeof v === "number" && v >= 0
      );
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

      if (selectedAmenities.length > 0) {
        const venueAmenities = v.amenities || [];
        const hasAllAmenities = selectedAmenities.every((a) =>
          venueAmenities.some((va) => va.toLowerCase().includes(a.toLowerCase()))
        );
        if (!hasAllAmenities) return false;
      }

      return true;
    });
    if (sortBy === "priceAsc")
      next = [...next].sort((a, b) => getDisplayPrice(a) - getDisplayPrice(b));
    else if (sortBy === "priceDesc")
      next = [...next].sort((a, b) => getDisplayPrice(b) - getDisplayPrice(a));
    else if (sortBy === "ratingDesc")
      next = [...next].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    setFilteredVenues(next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSportFilter(sportInput.trim());
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSportInput("");
    setAppliedSportFilter("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("0");
    setSortBy("relevance");
    setSelectedAmenities([]);
    setCurrentPage(1);
  };

  const activeFilters: ActiveFilter[] = [];
  if (minPrice || maxPrice) {
    activeFilters.push({
      id: "price",
      label: `${minPrice ? `₹${minPrice}` : "₹0"} - ${maxPrice ? `₹${maxPrice}` : "Max"}`,
      onRemove: () => {
        setMinPrice("");
        setMaxPrice("");
      },
    });
  }
  if (Number(minRating) > 0) {
    activeFilters.push({
      id: "rating",
      label: `${minRating}+ ★`,
      onRemove: () => setMinRating("0"),
    });
  }
  if (sortBy !== "relevance") {
    activeFilters.push({
      id: "sort",
      label: `Sort: ${sortBy === "priceAsc" ? "Price ↑" : sortBy === "priceDesc" ? "Price ↓" : "Top Rated"}`,
      onRemove: () => setSortBy("relevance"),
    });
  }
  selectedAmenities.forEach((am) => {
    activeFilters.push({
      id: `amenity-${am}`,
      label: am,
      onRemove: () => setSelectedAmenities((prev) => prev.filter((a) => a !== am)),
      badgeClassName: "bg-indigo-50 border-indigo-100 text-indigo-700",
      iconClassName: "hover:text-blue-900",
    });
  });

  const hasFilters = activeFilters.length > 0 || appliedSportFilter !== "";

  return (
    <div className="min-h-[60vh]">
      <FilterBar
        searchValue={sportInput}
        onSearchChange={setSportInput}
        searchPlaceholder="Search sports or venue names…"
        onSearchClear={() => setSportInput("")}
        onSubmit={handleSearch}
        isModalOpen={isFilterModalOpen}
        onModalOpenChange={setIsFilterModalOpen}
        activeFilters={activeFilters}
        onClearAll={handleClear}
        quickFilters={
          <SportChips
            value={appliedSportFilter}
            onSelect={(sport) => {
              setSportInput(sport);
              setAppliedSportFilter(sport);
              setCurrentPage(1);
            }}
          />
        }
      >
        {/* Price range */}
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Price Range (₹/hr)</label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="h-0.5 w-4 rounded-full bg-slate-300" />
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                ₹
              </span>
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Minimum Rating</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: "0", label: "Any" },
              { val: "3", label: "3+ ★" },
              { val: "4", label: "4+ ★" },
              { val: "4.5", label: "4.5+ ★" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMinRating(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  minRating === opt.val
                    ? "border-power-orange text-power-orange bg-orange-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Amenities */}
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Amenities</label>
          <div className="grid grid-cols-2 gap-2">
            {AMENITIES_OPTIONS.map((amenity) => {
              const isSelected = selectedAmenities.includes(amenity.id);
              return (
                <button
                  key={amenity.id}
                  type="button"
                  onClick={() => {
                    setSelectedAmenities((prev) =>
                      isSelected ? prev.filter((a) => a !== amenity.id) : [...prev, amenity.id]
                    );
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-all",
                    isSelected
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <amenity.icon size={16} />
                  {amenity.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort */}
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Sort By</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "relevance", label: "Recommended" },
              { val: "ratingDesc", label: "Top Rated" },
              { val: "priceAsc", label: "Price (Low to High)" },
              { val: "priceDesc", label: "Price (High to Low)" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setSortBy(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  sortBy === opt.val
                    ? "border-power-orange text-power-orange bg-orange-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </FilterBar>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-8xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="border-t-power-orange h-10 w-10 animate-spin rounded-full border-2 border-slate-100" />
            <p className="text-sm font-medium text-slate-500">Loading venues…</p>
          </div>
        ) : filteredVenues.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
            <Building2 size={40} className="mx-auto mb-3 text-slate-200" />
            <h3 className="text-lg font-bold text-slate-900">
              {appliedSportFilter ? `No venues for "${appliedSportFilter}"` : "No venues right now"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {appliedSportFilter
                ? "Try a different sport or clear filters."
                : "We're adding venues continuously. Check back soon."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {hasFilters && (
                <Button variant="secondary" onClick={handleClear}>
                  Clear filters
                </Button>
              )}
              <Button asChild variant="outline">
                <a href={communityUrl} target="_blank" rel="noreferrer">
                  <MessageCircle size={14} className="mr-1.5" />
                  Ask community
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

            <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredVenues.map((venue, index) => {
                const venueId = String(venue.id || venue._id || "");
                const isFollowed = followedVenueIds.includes(venueId);
                const venueImages = getVenueImageUrls(venue);

                const onToggleFollow = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!venueId) return;
                  clientFollowStore.toggle({
                    kind: "venue",
                    id: venueId,
                    label: venue.name,
                    subtitle: venue.address,
                    href: `/venues/${venueId}`,
                  });
                  setFollowedVenueIds(clientFollowStore.getByKind("venue").map((i) => i.id));
                };

                return (
                  <ListingCard
                    key={venueId || `${venue.name}-${index}`}
                    href={`/venues/${venueId}`}
                    title={venue.name}
                    shape="landscape"
                    media={
                      venueImages.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={venueImages[0]}
                          alt={venue.name}
                          loading="lazy"
                          className={LISTING_IMAGE_CLASS}
                        />
                      ) : (
                        <div className={LISTING_FALLBACK_CLASS}>
                          <Building2 aria-hidden strokeWidth={1.25} className="h-12 w-12" />
                        </div>
                      )
                    }
                    badge="Verified"
                    rating={venue.rating && venue.rating > 0 ? { value: venue.rating } : undefined}
                    subtitle={
                      venue.address ||
                      (venue.location
                        ? `${venue.location.coordinates[1].toFixed(3)}°N, ${venue.location.coordinates[0].toFixed(3)}°E`
                        : undefined)
                    }
                    details={venue.sports.slice(0, 2).join(" · ") || undefined}
                    price={`₹${getDisplayPrice(venue)}`}
                    priceUnit="per hour"
                    saved={isFollowed}
                    saveLabel={isFollowed ? "Unsave venue" : "Save venue"}
                    onToggleSave={onToggleFollow}
                    action={{ label: "Book", href: `/checkout?type=venue&venueId=${venueId}` }}
                  />
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft size={15} /> Prev
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum =
                      totalPages <= 5
                        ? i + 1
                        : currentPage <= 3
                          ? i + 1
                          : currentPage >= totalPages - 2
                            ? totalPages - 4 + i
                            : currentPage - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={loading}
                        className={cn(
                          "h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition-all",
                          currentPage === pageNum
                            ? "bg-power-orange-solid text-white shadow"
                            : "hover:border-power-orange hover:text-power-orange border border-slate-200 bg-white text-slate-700"
                        )}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                >
                  Next <ChevronRight size={15} />
                </Button>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-slate-500">
              Showing {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, totalVenues)} of{" "}
              {totalVenues} venues
            </p>
          </>
        )}
      </div>
    </div>
  );
}
