"use client";

import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import {
  StaggerContainer,
  StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { clientFollowStore } from "@/modules/shared/lib/followStore";
import { statsApi } from "@/modules/analytics/services/stats";
import { buildCoachCommunityIntent } from "@/modules/community/utils/coachCommunityIntent";
import { getCommunityAppUrl } from "@/lib/community/url";
import { Coach } from "@/types";
import { cn } from "@/utils/cn";
import {
  ArrowRight,
  Award,
  Bookmark,
  ImageIcon,
  MapPin,
  MessageCircle,
  Star,
  Users,
  X,
} from "lucide-react";
import { FilterBar, ActiveFilter } from "@/modules/discovery/components/FilterBar";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

const normalizeImageUrl = (value?: string) => {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/") || trimmed.startsWith("data:image")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.includes("amazonaws.com")) return `https://${trimmed}`;
  return trimmed;
};

const normalizeSearchTerm = (value: string) => value.toLocaleLowerCase().trim().replace(/\s+/g, " ");
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) => {
  const R = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDistanceKm = (km: number) => {
  if (!Number.isFinite(km) || km < 0) return "";
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
};

const parseCoordinates = (value: unknown) => {
  if (!value || typeof value !== "object") return null;
  const c = value as { coordinates?: unknown; lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
  if (Array.isArray(c.coordinates) && c.coordinates.length === 2) {
    const [lng, lat] = c.coordinates.map(Number);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { latitude: lat, longitude: lng };
  }
  const lat = Number(c.latitude ?? c.lat);
  const lng = Number(c.longitude ?? c.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  return null;
};


const SERVICE_MODE_OPTIONS = ["ALL", "OWN_VENUE", "FREELANCE", "HYBRID"];
const MIN_RATING_OPTIONS = ["0", "3", "4", "4.5"];
const SORT_OPTIONS = ["relevance", "nearest", "priceAsc", "priceDesc", "ratingDesc"];

function CoachImageWithFallback({ sources, alt, className, fallbackLabel }: { sources: string[]; alt: string; className: string; fallbackLabel: string }) {
  const cleaned = Array.from(new Set(sources.map(normalizeImageUrl).filter(Boolean)));
  const [idx, setIdx] = useState(0);
  useEffect(() => { setIdx(0); }, [cleaned.join("|")]);
  const src = cleaned[idx];
  if (!src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-200 text-slate-500">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-lg font-bold text-slate-700">{fallbackLabel}</div>
        <ImageIcon size={24} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setIdx((p) => p + 1)} />;
}

function CoachesTabContent() {
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);
  const [sportInput, setSportInput] = useState("");
  const [appliedSportFilter, setAppliedSportFilter] = useState("");
  const [serviceModeFilter, setServiceModeFilter] = useState("ALL");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const [maxRate, setMaxRate] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [hasLocationDenied, setHasLocationDenied] = useState(false);
  const [followedCoachIds, setFollowedCoachIds] = useState<string[]>([]);
  const hasHydratedRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const communityIntent = buildCoachCommunityIntent({ source: "coaches_list", selectedSport: appliedSportFilter || sportInput });
  const communityUrl = getCommunityAppUrl({
    path: "q",
    searchParams: { ask: "1", q: communityIntent.q, sport: communityIntent.sport, utm_source: "powermysport", utm_medium: "community_cta", utm_campaign: "coaches_list" },
  });

  const getVerificationBadge = (coach: Coach) => {
    const status = coach.verificationStatus || (coach.isVerified ? "VERIFIED" : "UNVERIFIED");
    if (status === "VERIFIED") return { label: "Verified", className: "bg-green-100 text-green-700 border border-green-200" };
    return { label: "Unverified", className: "bg-slate-100 text-slate-700 border border-slate-200" };
  };

  const getStartingRate = (coach: Coach) => {
    const values = Object.values(coach.sportPricing || {}).filter((v) => typeof v === "number" && v > 0);
    return values.length > 0 ? Math.min(...values) : coach.hourlyRate;
  };

  const getCoachImages = (coach: Coach) => {
    const u = typeof coach.userId === "object" && coach.userId !== null ? coach.userId : undefined;
    return [coach.photoUrl, coach.profileImage, u?.photoUrl, coach.ownVenueDetails?.images?.[0]].filter((v): v is string => typeof v === "string");
  };

  const getDisplayName = (coach: Coach) => {
    const u = typeof coach.userId === "object" && coach.userId !== null ? coach.userId : undefined;
    const name = u?.name;
    return typeof name === "string" && name.trim() ? name.trim() : `${coach.sports[0] || "Professional"} Coach`;
  };

  const getInitials = (coach: Coach) => {
    const parts = getDisplayName(coach).split(" ").filter(Boolean).slice(0, 2);
    return parts.length ? parts.map((p) => p[0]!.toUpperCase()).join("") : "CO";
  };

  const getServingCity = (coach: Coach) => {
    const parts = (coach.ownVenueDetails?.address || "").split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) return parts[parts.length - 3] || "";
    return parts[0] || "";
  };

  const getCoachCoords = (coach: Coach) => {
    const candidates = [coach.ownVenueDetails?.location, coach.baseLocation, (coach as any).location];
    for (const c of candidates) { const p = parseCoordinates(c); if (p) return p; }
    return null;
  };

  const getDistanceFromUser = (coach: Coach) => {
    if (!userLocation) return null;
    const coords = getCoachCoords(coach);
    return coords ? calculateDistanceKm(userLocation, coords) : null;
  };

  const getComparableRate = (coach: Coach) => {
    const r = Number(getStartingRate(coach));
    return Number.isFinite(r) && r > 0 ? r : null;
  };

  const getRelevanceScore = (coach: Coach, term: string) => {
    const rating = clamp01((coach.rating || 0) / 5);
    const reviews = clamp01((coach.reviewCount || 0) / 50);
    const rate = Number(getStartingRate(coach));
    const price = clamp01(1 - Math.min(Number.isFinite(rate) && rate > 0 ? rate : 5000, 5000) / 5000);
    let sportMatch = 0, nameMatch = 0;
    if (term) {
      if (coach.sports.some((s) => normalizeSearchTerm(s) === term)) sportMatch = 1;
      else if (coach.sports.some((s) => normalizeSearchTerm(s).includes(term))) sportMatch = 0.6;
      if (normalizeSearchTerm(getDisplayName(coach)).includes(term)) nameMatch = 0.6;
      else if (normalizeSearchTerm(coach.bio || "").includes(term)) nameMatch = 0.4;
    }
    return rating * 0.4 + reviews * 0.15 + price * 0.15 + sportMatch * 0.15 + nameMatch * 0.05;
  };

  const applyFilters = (base: Coach[]) => {
    const parsedMax = maxRate ? Number(maxRate) : undefined;
    const parsedRating = Number(minRating || 0);
    const term = normalizeSearchTerm(appliedSportFilter);
    let next = base.filter((coach) => {
      const name = normalizeSearchTerm(getDisplayName(coach));
      const bio = normalizeSearchTerm(coach.bio || "");
      const matchSearch = !term || coach.sports.some((s) => normalizeSearchTerm(s).includes(term)) || name.includes(term) || bio.includes(term);
      const matchMode = serviceModeFilter === "ALL" || coach.serviceMode === serviceModeFilter;
      const rate = getComparableRate(coach);
      const matchRate = parsedMax === undefined || isNaN(parsedMax) || (rate !== null && rate <= parsedMax);
      const matchVerified = !verifiedOnly || coach.isVerified || coach.verificationStatus === "VERIFIED";
      const matchCertified = !certifiedOnly || (coach.certifications && coach.certifications.length > 0);
      return matchSearch && matchMode && matchRate && (coach.rating || 0) >= parsedRating && matchVerified && matchCertified;
    });
    if (sortBy === "priceAsc") {
      next = [...next].sort((a, b) => { const ra = getComparableRate(a); const rb = getComparableRate(b); if (ra === null) return 1; if (rb === null) return -1; return ra - rb; });
    } else if (sortBy === "priceDesc") {
      next = [...next].sort((a, b) => { const ra = getComparableRate(a); const rb = getComparableRate(b); if (ra === null) return 1; if (rb === null) return -1; return rb - ra; });
    } else if (sortBy === "ratingDesc") {
      next = [...next].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "nearest") {
      next = [...next].sort((a, b) => {
        const da = getDistanceFromUser(a); const db = getDistanceFromUser(b);
        if (da === null && db === null) return getRelevanceScore(b, term) - getRelevanceScore(a, term);
        if (da === null) return 1; if (db === null) return -1;
        return da - db;
      });
    } else {
      next = [...next].sort((a, b) => getRelevanceScore(b, term) - getRelevanceScore(a, term));
    }
    setFilteredCoaches(next);
  };

  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    const sport = searchParams.get("sport") || "";
    setSportInput(sport); setAppliedSportFilter(normalizeSearchTerm(sport));
    const mode = searchParams.get("mode") || "ALL";
    if (SERVICE_MODE_OPTIONS.includes(mode)) setServiceModeFilter(mode);
    const mr = searchParams.get("maxRate") || "";
    if (mr && Number.isFinite(Number(mr))) setMaxRate(mr);
    const minR = searchParams.get("minRating") || "0";
    if (MIN_RATING_OPTIONS.includes(minR)) setMinRating(minR);
    const sort = searchParams.get("sort") || "relevance";
    if (SORT_OPTIONS.includes(sort)) setSortBy(sort);
  }, [searchParams]);

  useEffect(() => { applyFilters(coaches); }, [coaches, appliedSportFilter, serviceModeFilter, maxRate, minRating, sortBy, userLocation, verifiedOnly, certifiedOnly]);

  useEffect(() => {
    if (sortBy !== "nearest" || userLocation || !navigator.geolocation) {
      if (sortBy === "nearest" && !navigator.geolocation) setHasLocationDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setHasLocationDenied(false); },
      () => setHasLocationDenied(true),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [sortBy, userLocation]);

  useEffect(() => { setFollowedCoachIds(clientFollowStore.getByKind("coach").map((i) => i.id)); }, []);

  const loadCoaches = async (sportFilter = "") => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (sportFilter) params.sport = sportFilter;
      const response = await discoveryApi.searchNearbyCoaches(params);
      if (response.success && response.data) setCoaches(response.data.coaches || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadCoaches(appliedSportFilter); }, [appliedSportFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setAppliedSportFilter(normalizeSearchTerm(sportInput)); };
  const handleQuickFilter = (sport: string) => { setSportInput(sport); setAppliedSportFilter(normalizeSearchTerm(sport)); };
  const handleClear = () => { setSportInput(""); setAppliedSportFilter(""); setServiceModeFilter("ALL"); setMaxRate(""); setMinRating("0"); setSortBy("relevance"); setVerifiedOnly(false); setCertifiedOnly(false); };

  const activeFilters: ActiveFilter[] = [];
  if (serviceModeFilter !== "ALL") {
    activeFilters.push({ id: "mode", label: serviceModeFilter === "OWN_VENUE" ? "Own Venue" : serviceModeFilter === "FREELANCE" ? "Freelance" : "Hybrid", onRemove: () => setServiceModeFilter("ALL"), badgeClassName: "bg-green-50 border-green-100 text-turf-green", iconClassName: "hover:text-green-700" });
  }
  if (maxRate) {
    activeFilters.push({ id: "rate", label: `Max ₹${maxRate}/hr`, onRemove: () => setMaxRate(""), badgeClassName: "bg-green-50 border-green-100 text-turf-green", iconClassName: "hover:text-green-700" });
  }
  if (Number(minRating) > 0) {
    activeFilters.push({ id: "rating", label: `${minRating}+ ★`, onRemove: () => setMinRating("0"), badgeClassName: "bg-green-50 border-green-100 text-turf-green", iconClassName: "hover:text-green-700" });
  }
  if (sortBy !== "relevance") {
    activeFilters.push({ id: "sort", label: `Sort: ${sortBy === "priceAsc" ? "Price ↑" : sortBy === "priceDesc" ? "Price ↓" : sortBy === "nearest" ? "Nearest" : "Top Rated"}`, onRemove: () => setSortBy("relevance"), badgeClassName: "bg-green-50 border-green-100 text-turf-green", iconClassName: "hover:text-green-700" });
  }
  if (verifiedOnly) {
    activeFilters.push({ id: "verified", label: "Verified", onRemove: () => setVerifiedOnly(false), badgeClassName: "bg-emerald-50 border-emerald-100 text-emerald-700", iconClassName: "hover:text-emerald-900" });
  }
  if (certifiedOnly) {
    activeFilters.push({ id: "certified", label: "Certified", onRemove: () => setCertifiedOnly(false), badgeClassName: "bg-indigo-50 border-indigo-100 text-indigo-700", iconClassName: "hover:text-indigo-900" });
  }

  const hasFilters = activeFilters.length > 0 || appliedSportFilter !== "";

  return (
    <div>
      <FilterBar
        searchValue={sportInput}
        onSearchChange={setSportInput}
        searchPlaceholder="Search sports or coach names…"
        onSearchClear={() => setSportInput("")}
        onSubmit={handleSearch}
        isModalOpen={isFilterModalOpen}
        onModalOpenChange={setIsFilterModalOpen}
        activeFilters={activeFilters}
        onClearAll={handleClear}
      >
        {/* Service Mode */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Service Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "ALL", label: "Any" },
              { val: "OWN_VENUE", label: "Own Venue" },
              { val: "FREELANCE", label: "Freelance" },
              { val: "HYBRID", label: "Hybrid" }
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setServiceModeFilter(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  serviceModeFilter === opt.val
                    ? "border-turf-green bg-green-50 text-turf-green"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Max Rate */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Maximum Hourly Rate (₹)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
            <input
              type="number" min="0" value={maxRate} onChange={(e) => setMaxRate(e.target.value)}
              placeholder="Max ₹/hr"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:border-turf-green focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Industry Grade Filters: Verified and Certified */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Trust & Qualifications</label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all",
                verifiedOnly
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {verifiedOnly && <span className="text-emerald-500 font-bold">✓</span>}
              Verified Coaches Only
            </button>
            <button
              type="button"
              onClick={() => setCertifiedOnly(!certifiedOnly)}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all",
                certifiedOnly
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {certifiedOnly && <span className="text-indigo-500 font-bold">✓</span>}
              Certified Coaches Only
            </button>
          </div>
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Minimum Rating</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: "0", label: "Any" },
              { val: "3", label: "3+ ★" },
              { val: "4", label: "4+ ★" },
              { val: "4.5", label: "4.5+ ★" }
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMinRating(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  minRating === opt.val
                    ? "border-turf-green bg-green-50 text-turf-green"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm font-bold text-slate-900 mb-3">Sort By</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "relevance", label: "Recommended" },
              { val: "nearest", label: "Nearest" },
              { val: "priceAsc", label: "Price (Low to High)" },
              { val: "priceDesc", label: "Price (High to Low)" },
              { val: "ratingDesc", label: "Top Rated" }
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setSortBy(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all col-span-1",
                  opt.val === "ratingDesc" && "col-span-2 sm:col-span-1",
                  sortBy === opt.val
                    ? "border-turf-green bg-green-50 text-turf-green"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </FilterBar>



          {sortBy === "nearest" && hasLocationDenied && (
            <p className="mt-2 text-xs text-slate-500">Location access is off — showing all coaches.</p>
          )}
      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-100 border-t-turf-green" />
            <p className="text-sm font-medium text-slate-500">Loading coaches…</p>
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
            <Users size={40} className="mx-auto mb-3 text-slate-200" />
            <h3 className="text-lg font-bold text-slate-900">
              {appliedSportFilter ? `No coaches for "${appliedSportFilter}"` : "No coaches available"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {appliedSportFilter ? "Try a different sport or clear filters." : "Check back soon."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {hasFilters && <Button variant="secondary" onClick={handleClear}>Clear filters</Button>}
              <Button asChild variant="outline">
                <a href={communityUrl} target="_blank" rel="noreferrer" onClick={() => statsApi.trackFunnelEventNonBlocking({ eventName: "community_cta_click", entityType: "COACH", metadata: communityIntent.analyticsMetadata, source: "WEB" })}>
                  <MessageCircle size={14} className="mr-1.5" />Ask community
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <h2 className="font-title text-xl font-bold text-slate-900">
                {appliedSportFilter ? `${appliedSportFilter} Coaches` : "All Coaches"}
              </h2>
            </div>

            <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCoaches.map((coach, idx) => {
                const coachId = String(coach.id || coach._id || "");
                const key = coachId || `${String(coach.userId)}-${idx}`;
                const startingRate = Number(getStartingRate(coach));
                const hasRate = Number.isFinite(startingRate) && startingRate > 0;
                const primarySport = coach.sports[0] || "General";
                const dist = getDistanceFromUser(coach);
                const showDist = sortBy === "nearest" && userLocation !== null && dist !== null;
                const coachRoute = `/coaches/${coachId}`;
                const isFollowed = followedCoachIds.includes(coachId);
                const knownInCommunity = Number(coach.reviewCount || 0) >= 8 || (Number(coach.rating || 0) >= 4.4 && Number(coach.reviewCount || 0) >= 4);
                const badge = getVerificationBadge(coach);
                const name = getDisplayName(coach);
                const initials = getInitials(coach);
                const city = getServingCity(coach);

                const onToggleFollow = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (!coachId) return;
                  clientFollowStore.toggle({ kind: "coach", id: coachId, label: name, subtitle: coach.sports.join(", "), href: coachRoute });
                  setFollowedCoachIds(clientFollowStore.getByKind("coach").map((i) => i.id));
                };

                return (
                  <StaggerItem key={key} className="h-full">
                    <div
                      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgb(0,0,0,0.08)]"
                      onClick={() => router.push(coachRoute)}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(coachRoute); } }}
                      aria-label={`View coach profile for ${name}`}
                    >
                      <div className="relative aspect-3/4 w-full overflow-hidden bg-slate-100">
                        <CoachImageWithFallback sources={getCoachImages(coach)} alt={name} fallbackLabel={initials} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />

                        {/* Subtle Bookmark */}
                        <button
                          type="button" onClick={onToggleFollow}
                          className={cn(
                            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors",
                            isFollowed ? "border-white bg-white text-power-orange" : "border-white/20 bg-black/20 text-white hover:bg-black/40",
                          )}
                          aria-label={isFollowed ? "Unsave coach" : "Save coach"}
                        >
                          <Bookmark size={14} className={isFollowed ? "fill-current" : ""} />
                        </button>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">{name}</h3>
                        
                        {city && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500">
                            <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            <span className="line-clamp-1">{city} {showDist && <span className="font-semibold text-turf-green ml-1">({formatDistanceKm(dist!)})</span>}</span>
                          </p>
                        )}

                        {/* Badges */}
                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          {Number.isFinite(Number(coach.rating)) && Number(coach.rating) > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                              <Star size={12} className="fill-amber-400 text-amber-400" />
                              {Number(coach.rating).toFixed(1)}
                            </span>
                          )}
                          {badge.label === "Verified" && (
                            <span className="flex items-center gap-1 rounded-full bg-blue-50/50 px-2.5 py-1 text-xs font-semibold text-blue-600 ring-1 ring-inset ring-blue-100/50">
                              <Award size={12} />Verified
                            </span>
                          )}
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{primarySport}</span>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
                          {typeof coach.bio === "string" && coach.bio.trim() ? coach.bio.trim() : "Professional coach available for focused skill development and training sessions."}
                        </p>

                        <div className="mt-auto pt-5 flex items-center justify-between border-t border-slate-50">
                          <div>
                            {hasRate ? (
                              <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-slate-900">₹{startingRate}</span>
                                <span className="text-sm font-medium text-slate-400">/hr</span>
                              </div>
                            ) : (
                              <p className="text-sm font-bold text-slate-700">Contact Us</p>
                            )}
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition-all group-hover:-rotate-45 group-hover:bg-turf-green group-hover:text-white">
                            <ArrowRight size={17} strokeWidth={2.5} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </>
        )}
      </div>
    </div>
  );
}

export default function CoachesTab() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-100 border-t-turf-green" />
        <p className="text-sm font-medium text-slate-500">Loading coaches…</p>
      </div>
    }>
      <CoachesTabContent />
    </Suspense>
  );
}
