"use client";

import { sportsApi } from "@/modules/sports/services/sports";
import {
  PriceRangeSection,
  RatingSection,
  SortSection,
  priceRangeLabel,
} from "@/modules/discovery/components/FilterSections";
import { SportChips } from "@/modules/discovery/components/SportChips";
import { getCommunityAppUrl } from "@/lib/community/url";
import { ActiveFilter, FilterBar } from "@/modules/discovery/components/FilterBar";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { OnboardingAcademy } from "@/modules/onboarding/types/academy";
import { clientFollowStore } from "../../shared/store/followStore";
import { Button } from "@/modules/shared/ui/Button";
import {
  LISTING_FALLBACK_CLASS,
  LISTING_IMAGE_CLASS,
  ListingCard,
} from "@/modules/discovery/components/ListingCard";
import { cn } from "@/utils/cn";
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
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AcademyCard = OnboardingAcademy & {
  id?: string;
  slug?: string;
  city?: string;
  sports?: string[];
  rating?: number;
  reviewCount?: number;
  sessionRatePerHour?: number;
  logoUrl?: string;
  coverPhotoUrl?: string;
  ageGroups?: ("kids" | "teens" | "adults" | "all")[];
};

const AGE_GROUP_OPTIONS = [
  { value: "", label: "Age Group" },
  { value: "kids", label: "Kids (5-12)" },
  { value: "teens", label: "Teens (13-17)" },
  { value: "adults", label: "Adults (18+)" },
  { value: "all", label: "All Ages" },
];

const AMENITIES_OPTIONS = [
  { id: "Parking", label: "Parking", icon: Car },
  { id: "Washroom", label: "Washrooms", icon: Bath },
  { id: "Drinking Water", label: "Drinking Water", icon: Droplets },
  { id: "First Aid", label: "First Aid", icon: HeartPulse },
  { id: "Cafe", label: "Cafe/Snacks", icon: Coffee },
  { id: "Equipment", label: "Equipment", icon: Dumbbell },
];

const normalizeImageUrl = (value?: string) => {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image")
  )
    return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.includes("amazonaws.com")) return `https://${trimmed}`;
  return trimmed;
};

const toRupees = (paise?: number) => {
  if (typeof paise !== "number") return null;
  return Math.round(paise / 100);
};

const isVerifiedAcademy = (academy: AcademyCard) => {
  if (typeof academy.kycVerified === "boolean") return academy.kycVerified;
  if (typeof academy.isApproved === "boolean") return academy.isApproved;
  return true;
};

const academyMatchesAgeGroup = (academy: AcademyCard, ageGroup: string) => {
  if (!ageGroup) return true;
  if (!academy.ageGroups || academy.ageGroups.length === 0) return true;
  return academy.ageGroups.includes(ageGroup as "kids" | "teens" | "adults" | "all");
};

export default function AcademiesTab() {
  const [loading, setLoading] = useState(true);
  const [academies, setAcademies] = useState<AcademyCard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAcademies, setTotalAcademies] = useState(0);
  const [followedAcademyIds, setFollowedAcademyIds] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const communityUrl = useMemo(
    () =>
      getCommunityAppUrl({
        searchParams: {
          sidebar: "inbox",
          directory: "groups",
          panel: "discover",
          q: appliedSearch || sportFilter || undefined,
        },
      }),
    [appliedSearch, sportFilter]
  );

  useEffect(() => {
    let live = true;
    sportsApi
      .getDiscoverySports()
      .then((sports) => {
        if (live) setSportOptions(sports.map((s) => s.name));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const followed = clientFollowStore.getByKind("academy").map((item) => item.id);
    setFollowedAcademyIds(followed);
  }, []);

  useEffect(() => {
    void loadAcademies(currentPage);
  }, [currentPage, appliedSearch, sportFilter]);

  const loadAcademies = async (page: number) => {
    setLoading(true);
    try {
      const response = await academyOnboardingApi.listApprovedAcademies(page, 12, {
        search: appliedSearch || undefined,
        sport: sportFilter || undefined,
      });
      const payload = response.data;
      const apiAcademies = (payload?.academies || []) as AcademyCard[];
      const pagination = payload?.pagination;
      setAcademies(apiAcademies);
      setTotalAcademies(pagination?.total || apiAcademies.length);
      setTotalPages(Math.max(1, pagination?.totalPages || 1));
    } catch {
      setAcademies([]);
      setTotalAcademies(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const displayedAcademies = useMemo(() => {
    const parsedMin = minPrice ? Number(minPrice) : undefined;
    const parsedMax = maxPrice ? Number(maxPrice) : undefined;
    const parsedRating = Number(minRating || 0);
    const filtered = academies.filter((academy) => {
      const rupees = toRupees(academy.sessionRatePerHour);
      if ((academy.rating || 0) < parsedRating) return false;
      if (!academyMatchesAgeGroup(academy, ageGroupFilter)) return false;
      if (parsedMin !== undefined && !isNaN(parsedMin) && (rupees ?? 0) < parsedMin) return false;
      if (parsedMax !== undefined && !isNaN(parsedMax) && (rupees ?? 0) > parsedMax) return false;

      if (selectedAmenities.length > 0) {
        const acAmenities = (academy as any).amenities || [];
        const hasAllAmenities = selectedAmenities.every((a) =>
          acAmenities.some((va: string) => va.toLowerCase().includes(a.toLowerCase()))
        );
        if (!hasAllAmenities) return false;
      }

      return true;
    });
    const rate = (academy: AcademyCard) => toRupees(academy.sessionRatePerHour) ?? 0;
    if (sortBy === "priceAsc") return [...filtered].sort((a, b) => rate(a) - rate(b));
    if (sortBy === "priceDesc") return [...filtered].sort((a, b) => rate(b) - rate(a));
    if (sortBy === "ratingDesc")
      return [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return filtered;
  }, [academies, ageGroupFilter, minPrice, maxPrice, minRating, sortBy, selectedAmenities]);

  const handleApplySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setAppliedSearch(searchInput.trim());
  };
  const handleClearFilters = () => {
    setSearchInput("");
    setAppliedSearch("");
    setSportFilter("");
    setAgeGroupFilter("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("0");
    setSortBy("relevance");
    setSelectedAmenities([]);
    setCurrentPage(1);
  };

  const activeFilters: ActiveFilter[] = [];
  if (sportFilter) {
    activeFilters.push({
      id: "sport",
      label: sportFilter,
      onRemove: () => {
        setSportFilter("");
        setCurrentPage(1);
      },
    });
  }
  if (ageGroupFilter) {
    activeFilters.push({
      id: "age",
      label: `Age: ${AGE_GROUP_OPTIONS.find((o) => o.value === ageGroupFilter)?.label || ageGroupFilter}`,
      onRemove: () => setAgeGroupFilter(""),
    });
  }
  if (minPrice || maxPrice) {
    activeFilters.push({
      id: "price",
      label: priceRangeLabel(minPrice, maxPrice),
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
      label: `Sort: ${sortBy === "priceAsc" ? "Price ↑" : sortBy === "priceDesc" ? "Price ↓" : "Top rated"}`,
      onRemove: () => setSortBy("relevance"),
    });
  }
  selectedAmenities.forEach((am) => {
    activeFilters.push({
      id: `amenity-${am}`,
      label: am,
      onRemove: () => setSelectedAmenities((prev) => prev.filter((a) => a !== am)),
    });
  });

  return (
    <div>
      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by name, sport or city…"
        onSearchClear={() => {
          setSearchInput("");
          setAppliedSearch("");
          setCurrentPage(1);
        }}
        onSubmit={handleApplySearch}
        isModalOpen={isFilterModalOpen}
        onModalOpenChange={setIsFilterModalOpen}
        activeFilters={activeFilters}
        onClearAll={handleClearFilters}
        quickFilters={
          <SportChips
            value={sportFilter}
            onSelect={(sport) => {
              setSportFilter(sport);
              setCurrentPage(1);
            }}
          />
        }
      >
        {/* Sport */}
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Sport</label>
          <select
            value={sportFilter}
            onChange={(e) => {
              setSportFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 focus:bg-white focus:outline-none"
          >
            <option value="">All Sports</option>
            {sportOptions.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>

        {/* Age Group */}
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Age Group</label>
          <div className="grid grid-cols-2 gap-2">
            {AGE_GROUP_OPTIONS.slice(1).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAgeGroupFilter(opt.value)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  ageGroupFilter === opt.value
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
          <label className="mb-3 block text-sm font-bold text-slate-900">Facilities</label>
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

        <PriceRangeSection
          label="Price Range (₹/hr)"
          min={minPrice}
          max={maxPrice}
          onMinChange={setMinPrice}
          onMaxChange={setMaxPrice}
        />

        <RatingSection value={minRating} onChange={setMinRating} />

        <SortSection value={sortBy} onChange={setSortBy} />
      </FilterBar>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-8xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="border-t-power-orange h-10 w-10 animate-spin rounded-full border-2 border-slate-100" />
            <p className="text-sm font-medium text-slate-500">Loading academies…</p>
          </div>
        ) : displayedAcademies.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
            <Users size={40} className="mx-auto mb-3 text-slate-200" />
            <h3 className="text-lg font-bold text-slate-900">No academies match this filter</h3>
            <p className="mt-1 text-sm text-slate-500">
              Try changing city, sport, or pricing filters.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={handleClearFilters}>
                Clear filters
              </Button>
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
            <div className="mb-5">
              <h2 className="font-title text-xl font-bold text-slate-900">
                {sportFilter ? `${sportFilter} Academies` : "All Academies"}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedAcademies.map((academy) => {
                const coverImage =
                  normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl);
                const rupees = toRupees(academy.sessionRatePerHour);
                const detailsHref = academy.slug
                  ? `/academies/${academy.slug}`
                  : `/booking?tab=academies`;
                const academyId = String(academy.id || academy.slug || "");
                const isFollowed = followedAcademyIds.includes(academyId);
                const verified = isVerifiedAcademy(academy);

                const onToggleFollow = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!academyId) return;
                  clientFollowStore.toggle({
                    kind: "academy",
                    id: academyId,
                    label: academy.name,
                    subtitle: academy.city || "",
                    href: detailsHref,
                  });
                  setFollowedAcademyIds(
                    clientFollowStore.getByKind("academy").map((item) => item.id)
                  );
                };

                return (
                  <ListingCard
                    key={academy.id || academy.slug || academy.name}
                    href={detailsHref}
                    title={academy.name}
                    shape="landscape"
                    media={
                      coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverImage}
                          alt={academy.name}
                          loading="lazy"
                          className={LISTING_IMAGE_CLASS}
                        />
                      ) : (
                        <div className={LISTING_FALLBACK_CLASS}>
                          <Building2 aria-hidden strokeWidth={1.25} className="h-12 w-12" />
                        </div>
                      )
                    }
                    badge={verified ? "Verified" : undefined}
                    rating={
                      typeof academy.rating === "number" && academy.rating > 0
                        ? { value: academy.rating }
                        : undefined
                    }
                    subtitle={academy.city || undefined}
                    details={(academy.sports || []).slice(0, 2).join(" · ") || undefined}
                    price={typeof rupees === "number" ? `₹${rupees}` : "Price on request"}
                    priceUnit={typeof rupees === "number" ? "per hour" : undefined}
                    saved={isFollowed}
                    saveLabel={isFollowed ? "Unsave academy" : "Save academy"}
                    onToggleSave={onToggleFollow}
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
                  <ChevronLeft size={15} />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={loading}
                        className={cn(
                          "h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition-all",
                          currentPage === pageNum
                            ? "bg-power-orange-solid text-white shadow"
                            : "hover:border-power-orange hover:text-power-orange border border-slate-200 bg-white text-slate-700",
                          loading ? "cursor-not-allowed opacity-50" : ""
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
                  Next
                  <ChevronRight size={15} />
                </Button>
              </div>
            )}

            {totalAcademies > 0 && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Showing {(currentPage - 1) * 12 + 1}–{Math.min(currentPage * 12, totalAcademies)} of{" "}
                {totalAcademies} academies
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
