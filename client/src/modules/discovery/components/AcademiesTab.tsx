"use client";

import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { OnboardingAcademy } from "@/modules/onboarding/types/academy";
import { clientFollowStore } from "@/modules/shared/lib/followStore";
import { Button } from "@/modules/shared/ui/Button";
import { getCommunityAppUrl } from "@/lib/community/url";
import { cn } from "@/utils/cn";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageCircle,
  Star,
  Users,
  X,
  Car,
  Bath,
  Droplets,
  HeartPulse,
  Coffee,
  Dumbbell,
} from "lucide-react";
import { FilterBar, ActiveFilter } from "@/modules/discovery/components/FilterBar";
import { useRouter } from "next/navigation";
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

const SPORT_OPTIONS = ["Basketball", "Cricket", "Football", "Badminton", "Tennis", "Volleyball", "Kabaddi", "Swimming"];
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
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/") || trimmed.startsWith("data:image")) return trimmed;
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [academies, setAcademies] = useState<AcademyCard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAcademies, setTotalAcademies] = useState(0);
  const [followedAcademyIds, setFollowedAcademyIds] = useState<string[]>([]);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const communityUrl = useMemo(() => getCommunityAppUrl({
    searchParams: { sidebar: "inbox", directory: "groups", panel: "discover", q: cityFilter || sportFilter || undefined },
  }), [cityFilter, sportFilter]);

  useEffect(() => {
    const followed = clientFollowStore.getByKind("academy").map((item) => item.id);
    setFollowedAcademyIds(followed);
  }, []);

  useEffect(() => { void loadAcademies(currentPage); }, [currentPage, cityFilter, sportFilter]);

  const loadAcademies = async (page: number) => {
    setLoading(true);
    try {
      const response = await academyOnboardingApi.listApprovedAcademies(page, 12, {
        city: cityFilter || undefined,
        sport: sportFilter || undefined,
      });
      const payload = response.data;
      const apiAcademies = (payload?.academies || []) as AcademyCard[];
      const pagination = payload?.pagination;
      setAcademies(apiAcademies);
      setTotalAcademies(pagination?.total || apiAcademies.length);
      setTotalPages(Math.max(1, pagination?.totalPages || 1));
    } catch {
      setAcademies([]); setTotalAcademies(0); setTotalPages(1);
    } finally { setLoading(false); }
  };

  const displayedAcademies = useMemo(() => {
    const parsedMin = minPrice ? Number(minPrice) : undefined;
    const parsedMax = maxPrice ? Number(maxPrice) : undefined;
    return academies.filter((academy) => {
      const rupees = toRupees(academy.sessionRatePerHour);
      if (verifiedOnly && !isVerifiedAcademy(academy)) return false;
      if (!academyMatchesAgeGroup(academy, ageGroupFilter)) return false;
      if (parsedMin !== undefined && !isNaN(parsedMin) && (rupees ?? 0) < parsedMin) return false;
      if (parsedMax !== undefined && !isNaN(parsedMax) && (rupees ?? 0) > parsedMax) return false;
      
      if (selectedAmenities.length > 0) {
        const acAmenities = (academy as any).amenities || [];
        const hasAllAmenities = selectedAmenities.every(a => acAmenities.some((va: string) => va.toLowerCase().includes(a.toLowerCase())));
        if (!hasAllAmenities) return false;
      }
      
      return true;
    });
  }, [academies, ageGroupFilter, minPrice, maxPrice, verifiedOnly, selectedAmenities]);

  const hasFilters = cityFilter.length > 0 || sportFilter.length > 0 || ageGroupFilter.length > 0 || minPrice.length > 0 || maxPrice.length > 0 || !verifiedOnly;

  const handleApplySearch = (e: React.FormEvent) => { e.preventDefault(); setCurrentPage(1); setCityFilter(cityInput.trim()); };
  const handleClearFilters = () => { setCityInput(""); setCityFilter(""); setSportFilter(""); setAgeGroupFilter(""); setMinPrice(""); setMaxPrice(""); setVerifiedOnly(true); setSelectedAmenities([]); setCurrentPage(1); };

  const activeFilters: ActiveFilter[] = [];
  if (sportFilter) {
    activeFilters.push({ id: "sport", label: sportFilter, onRemove: () => { setSportFilter(""); setCurrentPage(1); } });
  }
  if (ageGroupFilter) {
    activeFilters.push({ id: "age", label: `Age: ${AGE_GROUP_OPTIONS.find(o => o.value === ageGroupFilter)?.label || ageGroupFilter}`, onRemove: () => setAgeGroupFilter("") });
  }
  if (minPrice || maxPrice) {
    activeFilters.push({ id: "price", label: `${minPrice ? `₹${minPrice}` : "₹0"} - ${maxPrice ? `₹${maxPrice}` : "Max"}`, onRemove: () => { setMinPrice(""); setMaxPrice(""); } });
  }
  if (verifiedOnly) {
    activeFilters.push({ id: "verified", label: "Verified", onRemove: () => setVerifiedOnly(false), badgeClassName: "bg-emerald-50 border-emerald-100 text-emerald-700", iconClassName: "hover:text-emerald-900" });
  }
  selectedAmenities.forEach(am => {
    activeFilters.push({ 
      id: `amenity-${am}`, 
      label: am, 
      onRemove: () => setSelectedAmenities(prev => prev.filter(a => a !== am)),
      badgeClassName: "bg-indigo-50 border-indigo-100 text-indigo-700",
      iconClassName: "hover:text-blue-900"
    });
  });

  return (
    <div>
      <FilterBar
        searchValue={cityInput}
        onSearchChange={setCityInput}
        searchPlaceholder="Search cities (Mumbai, Bengaluru…)"
        onSearchClear={() => { setCityInput(""); setCityFilter(""); }}
        onSubmit={handleApplySearch}
        isModalOpen={isFilterModalOpen}
        onModalOpenChange={setIsFilterModalOpen}
        activeFilters={activeFilters}
        onClearAll={handleClearFilters}
      >
        {/* Sport */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Sport</label>
          <select value={sportFilter} onChange={(e) => { setSportFilter(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-3 text-sm text-slate-900 focus:border-power-orange focus:bg-white focus:outline-none">
            <option value="">All Sports</option>
            {SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
          </select>
        </div>

        {/* Age Group */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Age Group</label>
          <div className="grid grid-cols-2 gap-2">
            {AGE_GROUP_OPTIONS.slice(1).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAgeGroupFilter(opt.value)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  ageGroupFilter === opt.value
                    ? "border-power-orange bg-orange-50 text-power-orange"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price range */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Price Range (₹/hr)</label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input
                type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:border-power-orange focus:bg-white focus:outline-none"
              />
            </div>
            <div className="h-0.5 w-4 bg-slate-300 rounded-full" />
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input
                type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:border-power-orange focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Facilities</label>
          <div className="grid grid-cols-2 gap-2">
            {AMENITIES_OPTIONS.map((amenity) => {
              const isSelected = selectedAmenities.includes(amenity.id);
              return (
                <button
                  key={amenity.id}
                  type="button"
                  onClick={() => {
                    setSelectedAmenities(prev => 
                      isSelected ? prev.filter(a => a !== amenity.id) : [...prev, amenity.id]
                    );
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border py-2.5 px-3 text-left text-sm font-semibold transition-all",
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

        {/* Verified toggle */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Trust</label>
          <button
            type="button"
            onClick={() => setVerifiedOnly((v) => !v)}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all",
              verifiedOnly
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {verifiedOnly && <BadgeCheck size={18} className="text-emerald-600" />}
            {verifiedOnly ? "Verified Academies Only" : "Show All Academies"}
          </button>
        </div>
      </FilterBar>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-100 border-t-power-orange" />
            <p className="text-sm font-medium text-slate-500">Loading academies…</p>
          </div>
        ) : displayedAcademies.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
            <Users size={40} className="mx-auto mb-3 text-slate-200" />
            <h3 className="text-lg font-bold text-slate-900">No academies match this filter</h3>
            <p className="mt-1 text-sm text-slate-500">Try changing city, sport, or pricing filters.</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={handleClearFilters}>Clear filters</Button>
              <Button asChild variant="outline">
                <a href={communityUrl} target="_blank" rel="noreferrer">
                  <MessageCircle size={14} className="mr-1.5" />Ask community
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayedAcademies.map((academy) => {
                const coverImage = normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl);
                const rupees = toRupees(academy.sessionRatePerHour);
                const detailsHref = academy.slug ? `/academies/${academy.slug}` : `/booking?tab=academies`;
                const academyId = String(academy.id || academy.slug || "");
                const isFollowed = followedAcademyIds.includes(academyId);
                const verified = isVerifiedAcademy(academy);

                const onToggleFollow = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!academyId) return;
                  clientFollowStore.toggle({ kind: "academy", id: academyId, label: academy.name, subtitle: academy.city || "", href: detailsHref });
                  setFollowedAcademyIds(clientFollowStore.getByKind("academy").map((item) => item.id));
                };

                return (
                  <div
                    key={academy.id || academy.slug || academy.name}
                    className="group cursor-pointer overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgb(0,0,0,0.08)]"
                    onClick={() => router.push(detailsHref)}
                  >
                    {/* Image */}
                    <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                      {coverImage ? (
                        <img src={coverImage} alt={academy.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                          <Building2 size={44} className="text-slate-300" />
                        </div>
                      )}
                      {/* Subtle Bookmark */}
                      <button
                        type="button" onClick={onToggleFollow}
                        className={cn(
                          "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors",
                          isFollowed ? "border-white bg-white text-power-orange" : "border-white/20 bg-black/20 text-white hover:bg-black/40",
                        )}
                        aria-label={isFollowed ? "Unsave academy" : "Save academy"}
                      >
                        <Bookmark size={14} className={isFollowed ? "fill-current" : ""} />
                      </button>
                    </div>

                    {/* Card body */}
                    <div className="p-5">
                      <h3 className="text-lg font-bold tracking-tight text-slate-900">{academy.name}</h3>

                      <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="line-clamp-1">{academy.city || "Location unavailable"}</span>
                      </p>

                      {/* Sport tags & Badges */}
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {typeof academy.rating === "number" && (
                          <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                            <Star size={12} className="fill-yellow-400 text-yellow-400" />
                            {academy.rating.toFixed(1)}
                          </span>
                        )}
                        {verified && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50/50 px-2.5 py-1 text-xs font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-100/50">
                            <BadgeCheck size={12} />Verified
                          </span>
                        )}
                        {(academy.sports || [])[0] && (
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{academy.sports![0]}</span>
                        )}
                      </div>

                      {/* Price + CTA */}
                      <div className="mt-5 flex items-center justify-between border-t border-slate-50 pt-4">
                        <div>
                          {typeof rupees === "number" ? (
                            <>
                              <span className="text-xl font-black text-slate-900">₹{rupees}</span>
                              <span className="ml-1 text-sm font-medium text-slate-500">/hr</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-slate-500">Price on request</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(detailsHref); }}
                          className="flex items-center gap-1.5 rounded-xl bg-power-orange px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
                        >
                          View <ArrowRight size={14} />
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
                  <ChevronLeft size={15} />Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => setCurrentPage(pageNum)} disabled={loading}
                        className={cn("h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition-all", currentPage === pageNum ? "bg-power-orange text-white shadow" : "border border-slate-200 bg-white text-slate-700 hover:border-power-orange hover:text-power-orange", loading ? "opacity-50 cursor-not-allowed" : "")}>
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || loading}>
                  Next<ChevronRight size={15} />
                </Button>
              </div>
            )}

            {totalAcademies > 0 && (
              <p className="mt-4 text-center text-xs text-slate-500">
                Showing {(currentPage - 1) * 12 + 1}–{Math.min(currentPage * 12, totalAcademies)} of {totalAcademies} academies
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
