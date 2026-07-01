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
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
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

const QUICK_SPORTS = ["Cricket", "Football", "Badminton", "Tennis", "Basketball", "Swimming"];
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
      return matchSearch && matchMode && matchRate && (coach.rating || 0) >= parsedRating;
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

  useEffect(() => { applyFilters(coaches); }, [coaches, appliedSportFilter, serviceModeFilter, maxRate, minRating, sortBy, userLocation]);

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
  const handleClear = () => { setSportInput(""); setAppliedSportFilter(""); setServiceModeFilter("ALL"); setMaxRate(""); setMinRating("0"); setSortBy("relevance"); };

  const hasFilters = appliedSportFilter || serviceModeFilter !== "ALL" || maxRate || Number(minRating) > 0;

  return (
    <div>
      {/* ── Compact filter bar ──────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <form onSubmit={handleSearch}>
            <div className="flex flex-col xl:flex-row xl:items-center gap-3">
              {/* Search input */}
              <div className="relative min-w-0 w-full xl:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                <input
                  type="text" value={sportInput} onChange={(e) => setSportInput(e.target.value)}
                  placeholder="Sport or coach name…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-turf-green focus:bg-white focus:outline-none focus:ring-1 focus:ring-turf-green/30"
                />
                {sportInput && (
                  <button type="button" onClick={() => setSportInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={13} /></button>
                )}
              </div>

              {/* Filters container */}
              <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                {/* Mode */}
                <select value={serviceModeFilter} onChange={(e) => setServiceModeFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-turf-green focus:outline-none flex-1 sm:flex-none min-w-[100px]">
                  <option value="ALL">Mode</option>
                  <option value="OWN_VENUE">Own Venue</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="HYBRID">Hybrid</option>
                </select>

                {/* Max rate */}
                <input type="number" min="0" value={maxRate} onChange={(e) => setMaxRate(e.target.value)} placeholder="Max ₹/hr"
                  className="w-full sm:w-28 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-turf-green focus:outline-none flex-1 sm:flex-none min-w-[100px]" />

                {/* Min rating */}
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-turf-green focus:outline-none flex-1 sm:flex-none min-w-[90px]">
                  <option value="0">Rating</option>
                  <option value="3">3+ ★</option>
                  <option value="4">4+ ★</option>
                  <option value="4.5">4.5+ ★</option>
                </select>

                {/* Sort */}
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-turf-green focus:outline-none flex-1 sm:flex-none min-w-[90px]">
                  <option value="relevance">Sort</option>
                  <option value="nearest">Nearest</option>
                  <option value="priceAsc">Price ↑</option>
                  <option value="priceDesc">Price ↓</option>
                  <option value="ratingDesc">Top Rated</option>
                </select>

                <button type="submit"
                  className="rounded-lg bg-turf-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600 flex-1 sm:flex-none">
                  Search
                </button>
                {hasFilters && (
                  <button type="button" onClick={handleClear} className="text-sm font-medium text-slate-500 hover:text-slate-800 px-2">
                    Clear
                  </button>
                )}
                {/* Result count */}
                {!loading && (
                  <span className="ml-auto text-xs font-medium text-slate-400 w-full sm:w-auto text-right sm:text-left mt-1 sm:mt-0">
                    {filteredCoaches.length} coach{filteredCoaches.length !== 1 ? "es" : ""}
                  </span>
                )}
              </div>
            </div>
          </form>

          {/* Quick sport pills */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {QUICK_SPORTS.map((s) => (
              <button key={s} type="button" onClick={() => handleQuickFilter(s)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                  appliedSportFilter === normalizeSearchTerm(s)
                    ? "border-turf-green bg-turf-green text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}>
                {s}
              </button>
            ))}
          </div>

          {sortBy === "nearest" && hasLocationDenied && (
            <p className="mt-2 text-xs text-slate-500">Location access is off — showing all coaches.</p>
          )}
        </div>
      </div>

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
                    <Card
                      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-turf-green/30 hover:shadow-md"
                      onClick={() => router.push(coachRoute)}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(coachRoute); } }}
                      aria-label={`View coach profile for ${name}`}
                    >
                      <div className="relative aspect-3/4 w-full overflow-hidden bg-slate-100">
                        <CoachImageWithFallback sources={getCoachImages(coach)} alt={name} fallbackLabel={initials} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/25 to-transparent" />

                        {/* Bookmark */}
                        <button
                          type="button" onClick={onToggleFollow}
                          className={cn(
                            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full shadow transition",
                            isFollowed ? "bg-power-orange text-white" : "bg-white/85 text-slate-600 backdrop-blur-sm hover:bg-white",
                          )}
                          aria-label={isFollowed ? "Unsave coach" : "Save coach"}
                        >
                          <Bookmark size={14} className={isFollowed ? "fill-current" : ""} />
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h4 className="line-clamp-1 text-xl font-extrabold tracking-tight text-white drop-shadow">{name}</h4>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/80">
                            {city && <span className="flex items-center gap-1"><MapPin size={11} className="text-white/60" />{city}</span>}
                            {showDist && <span className="font-semibold text-turf-green">{formatDistanceKm(dist!)}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-turf-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">{primarySport}</span>
                          {badge.label === "Verified" && (
                            <span className="flex items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                              <Award size={10} />Verified
                            </span>
                          )}
                          {knownInCommunity && (
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Community known</span>
                          )}
                        </div>

                        <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">
                          {typeof coach.bio === "string" && coach.bio.trim() ? coach.bio.trim() : "Professional coach available for focused skill development and training sessions."}
                        </p>

                        {coach.sports.length > 1 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {coach.sports.filter((s) => s !== primarySport).map((s) => (
                              <span key={s} className="rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 ring-1 ring-slate-100">{s}</span>
                            ))}
                          </div>
                        )}

                        <div className="mt-auto pt-3 grid grid-cols-3 gap-2">
                          {[
                            { label: "Rating", value: Number.isFinite(Number(coach.rating)) && Number(coach.rating) > 0 ? Number(coach.rating).toFixed(1) : "New", icon: <Star size={11} className="fill-amber-400 text-amber-400" /> },
                            { label: "Reviews", value: Number.isFinite(Number(coach.reviewCount)) && Number(coach.reviewCount) > 0 ? String(coach.reviewCount) : "New" },
                            { label: "Mode", value: (coach.serviceMode || "Flexible").replace(/_/g, " ") },
                          ].map(({ label, value, icon }) => (
                            <div key={label} className="flex flex-col items-center justify-center rounded-lg border border-slate-100 bg-slate-50 px-2 py-2.5">
                              <div className="flex items-center gap-1">
                                {icon}<span className="text-sm font-bold text-slate-800">{value}</span>
                              </div>
                              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            {hasRate ? (
                              <div className="flex items-baseline gap-1">
                                <span className="text-lg font-black text-slate-900">₹{startingRate}</span>
                                <span className="text-xs font-medium text-slate-400">/hr</span>
                              </div>
                            ) : (
                              <p className="text-sm font-bold text-slate-700">Contact Us</p>
                            )}
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition-all group-hover:-rotate-45 group-hover:bg-turf-green group-hover:text-white">
                            <ArrowRight size={17} strokeWidth={2.5} />
                          </div>
                        </div>
                      </div>
                    </Card>
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
