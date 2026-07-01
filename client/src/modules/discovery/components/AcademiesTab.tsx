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
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
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
  const [cityInput, setCityInput] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(true);

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
      return true;
    });
  }, [academies, ageGroupFilter, minPrice, maxPrice, verifiedOnly]);

  const hasFilters = cityFilter.length > 0 || sportFilter.length > 0 || ageGroupFilter.length > 0 || minPrice.length > 0 || maxPrice.length > 0 || !verifiedOnly;

  const handleApplySearch = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setCurrentPage(1); setCityFilter(cityInput.trim()); };
  const handleClearFilters = () => { setCityInput(""); setCityFilter(""); setSportFilter(""); setAgeGroupFilter(""); setMinPrice(""); setMaxPrice(""); setVerifiedOnly(true); setCurrentPage(1); };

  return (
    <div>
      {/* ── Compact filter bar ──────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <form onSubmit={handleApplySearch}>
            <div className="flex flex-wrap items-center gap-2">
              {/* City search */}
              <div className="relative min-w-0 flex-1 basis-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
                <input
                  type="text" value={cityInput} onChange={(e) => setCityInput(e.target.value)}
                  placeholder="City (Mumbai, Bengaluru…)"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:bg-white focus:outline-none focus:ring-1 focus:ring-power-orange/30"
                />
                {cityInput && (
                  <button type="button" onClick={() => { setCityInput(""); setCityFilter(""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X size={13} /></button>
                )}
              </div>

              {/* Sport */}
              <select value={sportFilter} onChange={(e) => { setSportFilter(e.target.value); setCurrentPage(1); }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none">
                <option value="">Sport</option>
                {SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
              </select>

              {/* Age group */}
              <select value={ageGroupFilter} onChange={(e) => setAgeGroupFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none">
                {AGE_GROUP_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>

              {/* Price range */}
              <input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Min ₹"
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none" />
              <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Max ₹"
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none" />

              {/* Verified toggle */}
              <button type="button" onClick={() => setVerifiedOnly((v) => !v)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition",
                  verifiedOnly ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600",
                )}>
                {verifiedOnly ? "✓ Verified" : "Verified"}
              </button>

              <button type="submit" className="rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600">
                Search
              </button>
              {hasFilters && (
                <button type="button" onClick={handleClearFilters} className="text-sm font-medium text-slate-500 hover:text-slate-800">Clear</button>
              )}

              {!loading && (
                <span className="ml-auto text-xs font-medium text-slate-400">
                  {displayedAcademies.length} academi{displayedAcademies.length !== 1 ? "es" : "y"}
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                    className="group cursor-pointer overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                    onClick={() => router.push(detailsHref)}
                  >
                    {/* Image */}
                    <div className="relative h-56 w-full overflow-hidden bg-slate-100">
                      {coverImage ? (
                        <img src={coverImage} alt={academy.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                          <Building2 size={44} className="text-slate-300" />
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />

                      {/* Sport chip */}
                      {(academy.sports || [])[0] && (
                        <div className="absolute bottom-3 left-3">
                          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm ring-1 ring-white/20">
                            {academy.sports![0]}
                          </span>
                        </div>
                      )}

                      {/* Bookmark */}
                      <button
                        type="button" onClick={onToggleFollow}
                        className={cn(
                          "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full shadow transition",
                          isFollowed ? "bg-power-orange text-white" : "bg-white/85 text-slate-600 backdrop-blur-sm hover:bg-white",
                        )}
                        aria-label={isFollowed ? "Unsave academy" : "Save academy"}
                      >
                        <Bookmark size={14} className={isFollowed ? "fill-current" : ""} />
                      </button>

                      {/* Rating */}
                      {typeof academy.rating === "number" && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-slate-800 shadow backdrop-blur-sm">
                          <Star size={11} className="fill-yellow-400 text-yellow-400" />
                          {academy.rating.toFixed(1)}
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <div className="p-4">
                      <h3 className="truncate text-[15px] font-bold text-slate-900">{academy.name}</h3>

                      <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
                        <MapPin size={12} className="mt-0.5 shrink-0 text-slate-400" />
                        <span className="line-clamp-1">{academy.city || "Location unavailable"}</span>
                      </p>

                      {/* Sport tags */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(academy.sports || []).slice(0, 4).map((sport, i) => (
                          <span key={i} className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100">{sport}</span>
                        ))}
                        {(academy.sports || []).length > 4 && (
                          <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-100">+{(academy.sports || []).length - 4}</span>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {verified && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                            <BadgeCheck size={10} />Verified
                          </span>
                        )}
                      </div>

                      {/* Price + CTA */}
                      <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                        <div>
                          {typeof rupees === "number" ? (
                            <>
                              <span className="text-lg font-black text-slate-900">₹{rupees}</span>
                              <span className="ml-1 text-xs font-medium text-slate-400">/hr</span>
                            </>
                          ) : (
                            <span className="text-sm font-bold text-slate-500">Price on request</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); router.push(detailsHref); }}
                          className="flex items-center gap-1 rounded-lg bg-power-orange px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
                        >
                          View <ArrowRight size={13} />
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
              <p className="mt-4 text-center text-xs text-slate-400">
                Showing {(currentPage - 1) * 12 + 1}–{Math.min(currentPage * 12, totalAcademies)} of {totalAcademies} academies
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
