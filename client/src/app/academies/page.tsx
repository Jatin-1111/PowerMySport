"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { OnboardingAcademy } from "@/modules/onboarding/types/academy";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Building2,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  MapPin,
  MessageCircle,
  Search,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clientFollowStore } from "@/modules/shared/lib/followStore";
import { getCommunityAppUrl } from "@/lib/community/url";

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

const SPORT_OPTIONS = [
  "Basketball",
  "Cricket",
  "Football",
  "Badminton",
  "Tennis",
  "Volleyball",
  "Kabaddi",
  "Swimming",
];

const AGE_GROUP_OPTIONS = [
  { value: "", label: "All Age Groups" },
  { value: "kids", label: "Kids (5-12)" },
  { value: "teens", label: "Teens (13-17)" },
  { value: "adults", label: "Adults (18+)" },
  { value: "all", label: "All Ages" },
];

const normalizeImageUrl = (value?: string) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.includes("amazonaws.com")) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

const toRupees = (paise?: number) => {
  if (typeof paise !== "number") {
    return null;
  }
  return Math.round(paise / 100);
};

const isVerifiedAcademy = (academy: AcademyCard) => {
  if (typeof academy.kycVerified === "boolean") {
    return academy.kycVerified;
  }
  if (typeof academy.isApproved === "boolean") {
    return academy.isApproved;
  }
  // Public endpoint currently returns only approved + KYC verified academies.
  return true;
};

const academyMatchesAgeGroup = (academy: AcademyCard, ageGroup: string) => {
  if (!ageGroup) return true;
  if (!academy.ageGroups || academy.ageGroups.length === 0) {
    return true;
  }
  return academy.ageGroups.includes(
    ageGroup as "kids" | "teens" | "adults" | "all",
  );
};

export default function AcademiesPage() {
  const [loading, setLoading] = useState(true);
  const [academies, setAcademies] = useState<AcademyCard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAcademies, setTotalAcademies] = useState(0);
  const [followedAcademyIds, setFollowedAcademyIds] = useState<string[]>([]);
  const router = useRouter();

  const [cityInput, setCityInput] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [ageGroupFilter, setAgeGroupFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(true);

  const communityUrl = useMemo(() => getCommunityAppUrl({
    searchParams: {
      sidebar: "inbox",
      directory: "groups",
      panel: "discover",
      q: cityFilter || sportFilter || undefined,
    },
  }), [cityFilter, sportFilter]);

  useEffect(() => {
    const followed = clientFollowStore
      .getByKind("academy")
      .map((item) => item.id);
    setFollowedAcademyIds(followed);
  }, []);

  useEffect(() => {
    void loadAcademies(currentPage);
  }, [currentPage, cityFilter, sportFilter]);

  const loadAcademies = async (page: number) => {
    setLoading(true);

    try {
      const response = await academyOnboardingApi.listApprovedAcademies(
        page,
        12,
        {
          city: cityFilter || undefined,
          sport: sportFilter || undefined,
        },
      );

      const payload = response.data;
      const apiAcademies = (payload?.academies || []) as AcademyCard[];
      const pagination = payload?.pagination;

      setAcademies(apiAcademies);
      setTotalAcademies(pagination?.total || apiAcademies.length);
      setTotalPages(Math.max(1, pagination?.totalPages || 1));
    } catch (error) {
      console.error("Failed to load academies:", error);
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

    return academies.filter((academy) => {
      const rupees = toRupees(academy.sessionRatePerHour);
      const verified = isVerifiedAcademy(academy);

      if (verifiedOnly && !verified) {
        return false;
      }

      if (!academyMatchesAgeGroup(academy, ageGroupFilter)) {
        return false;
      }

      if (parsedMin !== undefined && !Number.isNaN(parsedMin)) {
        if ((rupees ?? 0) < parsedMin) {
          return false;
        }
      }

      if (parsedMax !== undefined && !Number.isNaN(parsedMax)) {
        if ((rupees ?? 0) > parsedMax) {
          return false;
        }
      }

      return true;
    });
  }, [academies, ageGroupFilter, minPrice, maxPrice, verifiedOnly]);

  const hasFilters =
    cityFilter.length > 0 ||
    sportFilter.length > 0 ||
    ageGroupFilter.length > 0 ||
    minPrice.length > 0 ||
    maxPrice.length > 0 ||
    !verifiedOnly;

  const handleApplySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCurrentPage(1);
    setCityFilter(cityInput.trim());
  };

  const handleClearFilters = () => {
    setCityInput("");
    setCityFilter("");
    setSportFilter("");
    setAgeGroupFilter("");
    setMinPrice("");
    setMaxPrice("");
    setVerifiedOnly(true);
    setCurrentPage(1);
  };

  const activeFilters = [
    cityFilter ? `City: ${cityFilter}` : null,
    sportFilter ? `Sport: ${sportFilter}` : null,
    ageGroupFilter ? `Age: ${AGE_GROUP_OPTIONS.find(o => o.value === ageGroupFilter)?.label || ageGroupFilter}` : null,
    minPrice ? `Min ₹${minPrice}` : null,
    maxPrice ? `Max ₹${maxPrice}` : null,
    verifiedOnly ? `Verified Only` : null,
  ].filter(Boolean) as string[];

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_46%,#fff8ee_100%)] flex flex-col">
      <Navigation sticky />

      <main className="flex-1">
        <div className="bg-white/70 border-b border-white/60 backdrop-blur-md">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#f8fbff_0%,#e5f1ff_38%,#fff4e2_100%)] p-6 text-slate-900 shadow-sm sm:p-8">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <Users size={32} className="text-power-orange" />
                  <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Academy Discovery
                  </span>
                </div>
                <h1 className="font-title text-3xl sm:text-4xl font-bold mb-3">
                  Find Top Sports Academies
                </h1>
                <p className="text-slate-700 text-base sm:text-lg mb-6 max-w-2xl">
                  Explore verified academies by city, sport, age group, and pricing.
                </p>

                <form
                  onSubmit={handleApplySearch}
                  className="flex flex-col sm:flex-row gap-3 max-w-2xl"
                >
                  <div className="relative flex-1">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      size={20}
                    />
                    <input
                      type="text"
                      value={cityInput}
                      onChange={(event) => setCityInput(event.target.value)}
                      placeholder="Search city (e.g. Mumbai, Bengaluru)"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-power-orange/50 focus:border-power-orange bg-white text-slate-900 font-medium"
                      aria-label="Search academies by city"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full rounded-xl px-8 premium-shadow sm:w-auto sm:whitespace-nowrap"
                  >
                    <Search size={18} className="mr-2" />
                    Apply City
                  </Button>
                </form>

                <div className="mt-5 max-w-6xl rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur-md">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Refine Results
                    </p>
                    {hasFilters && (
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
                        value={sportFilter}
                        onChange={(event) => {
                          setSportFilter(event.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      >
                        <option value="">All Sports</option>
                        {SPORT_OPTIONS.map((sport) => (
                          <option key={sport} value={sport}>
                            {sport}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Age Group
                      </span>
                      <select
                        value={ageGroupFilter}
                        onChange={(event) =>
                          setAgeGroupFilter(event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      >
                        {AGE_GROUP_OPTIONS.map((option, index) => (
                          <option key={`age-group-${index}`} value={option.value}>
                            {option.label}
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
                        onChange={(event) => setMinPrice(event.target.value)}
                        placeholder="₹500"
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
                        onChange={(event) => setMaxPrice(event.target.value)}
                        placeholder="₹2500"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Verified
                      </span>
                      <button
                        type="button"
                        onClick={() => setVerifiedOnly((value) => !value)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                          verifiedOnly
                            ? "border-green-200 bg-green-50 text-green-700"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {verifiedOnly ? "Verified Only" : "All Academies"}
                      </button>
                    </label>
                  </div>

                  {hasActiveFilters && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeFilters.map((filter) => (
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

        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading academies...</p>
            </div>
          ) : displayedAcademies.length === 0 ? (
            <Card className="premium-shadow overflow-hidden rounded-3xl border border-slate-200/70 bg-white/92 p-6 backdrop-blur-sm sm:p-8">
              <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-6 sm:p-7">
                  <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Users size={30} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    No academies match this filter
                  </h3>
                  <p className="mt-2 text-slate-600">
                    We couldn't find any academies for the selected filters. Try changing city, sport, or pricing filters.
                  </p>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={handleClearFilters}>
                      Clear Search
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void loadAcademies(1);
                        setCurrentPage(1);
                      }}
                    >
                      Refresh Results
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-power-orange">
                      <MessageCircle size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Need help choosing an academy?
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Ask local players and coaches for recommendations, then jump back and book with confidence.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <Button
                      asChild
                      variant="secondary"
                      className="w-full rounded-xl"
                    >
                      <a href={communityUrl} target="_blank" rel="noreferrer">
                        Ask in Community
                        <ArrowRight size={16} className="ml-2" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="font-title text-2xl font-bold text-slate-900">
                    {sportFilter ? `${sportFilter} Academies` : "All Academies"}
                  </h2>
                  <p className="text-slate-600 mt-1">
                    {displayedAcademies.length} academi{displayedAcademies.length !== 1 ? "es" : "y"} on this page
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayedAcademies.map((academy) => {
                  const coverImage =
                    normalizeImageUrl(academy.coverPhotoUrl) ||
                    normalizeImageUrl(academy.logoUrl);
                  const rupees = toRupees(academy.sessionRatePerHour);
                  const detailsHref = academy.slug
                    ? `/academies/${academy.slug}`
                    : academy.id
                      ? `/academy/onboarding/success/${academy.id}`
                      : "/academies";

                  const academyId = String(academy.id || academy.slug || "");
                  const isFollowed = followedAcademyIds.includes(academyId);

                  const onToggleFollowAcademy = () => {
                    if (!academyId) return;
                    clientFollowStore.toggle({
                      kind: "academy",
                      id: academyId,
                      label: academy.name,
                      subtitle: academy.city || "",
                      href: detailsHref,
                    });
                    const followed = clientFollowStore
                      .getByKind("academy")
                      .map((item) => item.id);
                    setFollowedAcademyIds(followed);
                  };

                  return (
                    <Card
                      key={academy.id || academy.slug || academy.name}
                      className="premium-shadow overflow-hidden rounded-3xl border border-slate-200/70 bg-white/92 p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group cursor-pointer"
                      onClick={() => router.push(detailsHref)}
                    >
                      <div className="relative h-52 w-full overflow-hidden bg-slate-100">
                        {coverImage ? (
                          <>
                            <img
                              src={coverImage}
                              alt={academy.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/55 via-black/20 to-transparent" />
                          </>
                        ) : (
                          <div className="h-52 w-full bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            <Users size={48} className="text-slate-300" />
                          </div>
                        )}

                        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                          {isVerifiedAcademy(academy) && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-black/35 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                              <BadgeCheck size={12} className="text-green-400" />
                              Verified
                            </span>
                          )}
                          {(academy.sports || [])[0] && (
                            <span className="rounded-full border border-white/40 bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                              {academy.sports![0]}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-bold text-slate-900 flex-1 line-clamp-1">
                            {academy.name}
                          </h3>
                          <div className="flex items-center gap-1 ml-2">
                            <Star
                              size={16}
                              className="text-yellow-500 fill-yellow-500"
                            />
                            <span className="text-sm font-semibold text-slate-700">
                              {typeof academy.rating === "number"
                                ? academy.rating.toFixed(1)
                                : "New"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <p className="text-sm text-slate-600 flex items-start gap-2">
                            <MapPin
                              size={16}
                              className="text-power-orange shrink-0 mt-0.5"
                            />
                            <span className="line-clamp-2">
                              {academy.city || "City unavailable"}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {(academy.sports || []).slice(0, 3).map((sport, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium"
                            >
                              {sport}
                            </span>
                          ))}
                          {(academy.sports || []).length > 3 && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium">
                              +{(academy.sports || []).length - 3} more
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
                                {typeof rupees === "number" ? rupees : "N/A"}
                                {typeof rupees === "number" && (
                                  <span className="text-sm text-slate-500 font-normal">
                                    /hr
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="primary"
                              size="sm"
                              className="group-hover:shadow-lg transition-shadow"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(detailsHref);
                              }}
                            >
                              Book
                              <ArrowRight size={16} className="ml-1" />
                            </Button>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFollowAcademy();
                            }}
                            className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                              isFollowed
                                ? "border-power-orange/30 bg-power-orange/10 text-power-orange"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <Bookmark
                              size={13}
                              className={isFollowed ? "fill-current" : ""}
                            />
                            {isFollowed ? "Saved" : "Save Academy"}
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

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

              <div className="mt-4 text-center text-sm text-slate-600">
                Showing {(currentPage - 1) * 12 + 1} -{" "}
                {Math.min(currentPage * 12, totalAcademies)} of {totalAcademies}{" "}
                academies
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
