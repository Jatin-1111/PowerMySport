"use client";

import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Modal } from "@/modules/shared/ui/Modal";
import { Coach } from "@/types";
import {
  ArrowRight,
  Award,
  FilterX,
  ImageIcon,
  IndianRupee,
  Search,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

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

const normalizeSearchTerm = (value: string) =>
  value.toLocaleLowerCase().trim().replace(/\s+/g, " ");

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const QUICK_SPORT_FILTERS = [
  "Cricket",
  "Football",
  "Badminton",
  "Tennis",
  "Basketball",
  "Swimming",
];

const SERVICE_MODE_OPTIONS = ["ALL", "OWN_VENUE", "FREELANCE", "HYBRID"];
const MIN_RATING_OPTIONS = ["0", "3", "4", "4.5"];
const SORT_OPTIONS = ["relevance", "priceAsc", "priceDesc", "ratingDesc"];

const CoachImageWithFallback = ({
  sources,
  alt,
  className,
  fallbackLabel,
}: {
  sources: string[];
  alt: string;
  className: string;
  fallbackLabel: string;
}) => {
  const cleanedSources = Array.from(
    new Set(
      sources
        .map((source) => normalizeImageUrl(source))
        .filter((source) => source.length > 0),
    ),
  );

  const [sourceIndex, setSourceIndex] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
  }, [cleanedSources.join("|")]);

  const currentSource = cleanedSources[sourceIndex];

  if (!currentSource) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-200 text-slate-500">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-lg font-bold text-slate-700">
          {fallbackLabel}
        </div>
        <ImageIcon size={24} />
      </div>
    );
  }

  return (
    <img
      src={currentSource}
      alt={alt}
      className={className}
      onError={() => setSourceIndex((previous) => previous + 1)}
    />
  );
};

function CoachesPageContent() {
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);
  const [sportInput, setSportInput] = useState("");
  const [appliedSportFilter, setAppliedSportFilter] = useState("");
  const [serviceModeFilter, setServiceModeFilter] = useState("ALL");
  const [maxRate, setMaxRate] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [locationError, setLocationError] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const hasRequestedInitialLoadRef = useRef(false);
  const hasHydratedFromUrlRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hasHydratedFromUrlRef.current) {
      return;
    }

    hasHydratedFromUrlRef.current = true;

    const sportParam = searchParams.get("sport") || "";
    const normalizedSportParam = normalizeSearchTerm(sportParam);

    const serviceModeParam = searchParams.get("mode") || "ALL";
    const maxRateParam = searchParams.get("maxRate") || "";
    const minRatingParam = searchParams.get("minRating") || "0";
    const sortParam = searchParams.get("sort") || "relevance";
    const showFiltersParam = searchParams.get("filters") === "1";

    const parsedMaxRate = Number(maxRateParam);
    const sanitizedMaxRate =
      maxRateParam && Number.isFinite(parsedMaxRate) && parsedMaxRate >= 0
        ? maxRateParam
        : "";

    setSportInput(sportParam);
    setAppliedSportFilter(normalizedSportParam);
    setServiceModeFilter(
      SERVICE_MODE_OPTIONS.includes(serviceModeParam)
        ? serviceModeParam
        : "ALL",
    );
    setMaxRate(sanitizedMaxRate);
    setMinRating(
      MIN_RATING_OPTIONS.includes(minRatingParam) ? minRatingParam : "0",
    );
    setSortBy(SORT_OPTIONS.includes(sortParam) ? sortParam : "relevance");
    setShowAdvancedFilters(showFiltersParam);
  }, [searchParams]);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        "Location access is required to discover nearby coaches.",
      );
      setCoaches([]);
      setFilteredCoaches([]);
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationError("");
        await loadCoaches(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        const permissionMessage =
          error.code === error.PERMISSION_DENIED
            ? "Location permission is blocked. Please enable location access in your browser site settings and try again."
            : "Location access is required to discover nearby coaches. Please enable location and try again.";

        setLocationError(permissionMessage);
        setCoaches([]);
        setFilteredCoaches([]);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  };

  const requestLocationAndLoadCoaches = () => {
    setLoading(true);
    requestCurrentLocation();
  };

  const handleTryLocationAgain = () => {
    setLoading(true);
    requestCurrentLocation();
  };

  const handleOpenLocationSettings = () => {
    const userAgent = navigator.userAgent.toLowerCase();

    const settingsHelpUrl = userAgent.includes("edg/")
      ? "https://support.microsoft.com/microsoft-edge/website-permissions-3f2e58fa-0b99-4f9a-9f3f-7a90f0cc01bb"
      : userAgent.includes("chrome")
        ? "https://support.google.com/chrome/answer/142065"
        : userAgent.includes("firefox")
          ? "https://support.mozilla.org/en-US/kb/permission-manager-give-or-revoke-site-permissions"
          : "https://support.apple.com/guide/safari/customize-website-settings-sfri40734/mac";

    window.open(settingsHelpUrl, "_blank", "noopener,noreferrer");
  };

  const getVerificationBadge = (coach: Coach) => {
    const status =
      coach.verificationStatus ||
      (coach.isVerified ? "VERIFIED" : "UNVERIFIED");

    switch (status) {
      case "VERIFIED":
        return {
          label: "Verified",
          className: "bg-green-100 text-green-700 border border-green-200",
        };
      case "PENDING":
        return {
          label: "Pending",
          className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
        };
      case "REVIEW":
        return {
          label: "In Review",
          className: "bg-blue-100 text-blue-700 border border-blue-200",
        };
      case "REJECTED":
        return {
          label: "Rejected",
          className: "bg-red-100 text-red-700 border border-red-200",
        };
      default:
        return {
          label: "Unverified",
          className: "bg-slate-100 text-slate-700 border border-slate-200",
        };
    }
  };

  const getSportRate = (coach: Coach, sport: string) => {
    const sportRate = coach.sportPricing?.[sport];
    if (typeof sportRate === "number" && sportRate > 0) {
      return sportRate;
    }
    return coach.hourlyRate;
  };

  const getStartingRate = (coach: Coach) => {
    const values = Object.values(coach.sportPricing || {}).filter(
      (value) => typeof value === "number" && value > 0,
    );
    if (values.length > 0) {
      return Math.min(...values);
    }
    return coach.hourlyRate;
  };

  const getCoachImageCandidates = (coach: Coach) => {
    const coachUser =
      typeof coach.userId === "object" && coach.userId !== null
        ? coach.userId
        : undefined;

    return [
      coach.photoUrl,
      coach.profileImage,
      coachUser?.photoUrl,
      coach.ownVenueDetails?.images?.[0],
    ].filter((value): value is string => typeof value === "string");
  };

  const getCoachVenueImage = (coach: Coach) => {
    const venueImages = coach.ownVenueDetails?.images || [];
    return venueImages.find(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    );
  };

  const getCoachDisplayName = (coach: Coach) => {
    const coachUser =
      typeof coach.userId === "object" && coach.userId !== null
        ? coach.userId
        : undefined;

    const rawName = coachUser?.name;
    if (typeof rawName === "string" && rawName.trim().length > 0) {
      return rawName.trim();
    }

    return `${coach.sports[0] || "Professional"} Coach`;
  };

  const getCoachInitials = (coach: Coach) => {
    const name = getCoachDisplayName(coach);
    const parts = name
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) {
      return "CO";
    }

    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  };

  const getCoachSportsSummary = (coach: Coach) => {
    if (!Array.isArray(coach.sports) || coach.sports.length === 0) {
      return "Multi-sport coaching";
    }

    return coach.sports.join(", ");
  };

  const getCoachBioSummary = (coach: Coach) => {
    if (typeof coach.bio === "string" && coach.bio.trim().length > 0) {
      return coach.bio.trim();
    }

    return "Professional coach available for focused skill development and guided training sessions.";
  };

  const getDisplayRating = (coach: Coach) => {
    const numericRating = Number(coach.rating);
    if (!Number.isFinite(numericRating) || numericRating <= 0) {
      return "New";
    }

    return numericRating.toFixed(1);
  };

  const getDisplayReviewCount = (coach: Coach) => {
    const reviews = Number(coach.reviewCount);
    if (!Number.isFinite(reviews) || reviews <= 0) {
      return "No reviews yet";
    }

    return `${reviews} review${reviews !== 1 ? "s" : ""}`;
  };

  const getServiceModeLabel = (coach: Coach) => {
    if (typeof coach.serviceMode !== "string" || !coach.serviceMode.trim()) {
      return "Flexible";
    }

    return coach.serviceMode.replace(/_/g, " ");
  };

  const getPrimarySport = (coach: Coach) => {
    if (!Array.isArray(coach.sports) || coach.sports.length === 0) {
      return "General";
    }

    return coach.sports[0];
  };

  const getAdditionalSportsCount = (coach: Coach) => {
    if (!Array.isArray(coach.sports) || coach.sports.length <= 1) {
      return 0;
    }

    return coach.sports.length - 1;
  };

  const getComparableRate = (coach: Coach) => {
    const rate = Number(getStartingRate(coach));
    if (!Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    return rate;
  };

  const getRelevanceScore = (coach: Coach, normalizedSearchTerm: string) => {
    const ratingScore = clamp01((coach.rating || 0) / 5);
    const reviewScore = clamp01((coach.reviewCount || 0) / 50);

    const startingRate = Number(getStartingRate(coach));
    const normalizedRate =
      Number.isFinite(startingRate) && startingRate > 0 ? startingRate : 5000;
    const priceScore = clamp01(1 - Math.min(normalizedRate, 5000) / 5000);

    let verificationRecencyScore = 0;
    if (coach.verifiedAt) {
      const verifiedTime = new Date(coach.verifiedAt).getTime();
      if (!Number.isNaN(verifiedTime)) {
        const daysSinceVerified =
          (Date.now() - verifiedTime) / (1000 * 60 * 60 * 24);
        verificationRecencyScore = clamp01(1 - daysSinceVerified / 365);
      }
    }

    let sportMatchScore = 0;
    let nameBioMatchScore = 0;

    if (normalizedSearchTerm) {
      const exactSportMatch = coach.sports.some(
        (sport) => normalizeSearchTerm(sport) === normalizedSearchTerm,
      );
      const partialSportMatch = coach.sports.some((sport) =>
        normalizeSearchTerm(sport).includes(normalizedSearchTerm),
      );

      if (exactSportMatch) {
        sportMatchScore = 1;
      } else if (partialSportMatch) {
        sportMatchScore = 0.6;
      }

      const coachName = normalizeSearchTerm(getCoachDisplayName(coach));
      const coachBio = normalizeSearchTerm(coach.bio || "");
      if (coachName.includes(normalizedSearchTerm)) {
        nameBioMatchScore = 0.6;
      } else if (coachBio.includes(normalizedSearchTerm)) {
        nameBioMatchScore = 0.4;
      }
    }

    return (
      ratingScore * 0.4 +
      reviewScore * 0.15 +
      priceScore * 0.15 +
      verificationRecencyScore * 0.1 +
      sportMatchScore * 0.15 +
      nameBioMatchScore * 0.05
    );
  };

  const applyCoachFilters = (baseCoaches: Coach[]) => {
    const parsedMaxRate = maxRate ? Number(maxRate) : undefined;
    const parsedMinRating = Number(minRating || 0);
    const normalizedSearchTerm = normalizeSearchTerm(appliedSportFilter);

    let next = baseCoaches.filter((coach) => {
      const coachName = normalizeSearchTerm(getCoachDisplayName(coach));
      const coachBio = normalizeSearchTerm(coach.bio || "");
      const matchesSearchTerm =
        !normalizedSearchTerm ||
        coach.sports.some((sport) =>
          normalizeSearchTerm(sport).includes(normalizedSearchTerm),
        ) ||
        coachName.includes(normalizedSearchTerm) ||
        coachBio.includes(normalizedSearchTerm);

      const matchesServiceMode =
        serviceModeFilter === "ALL" || coach.serviceMode === serviceModeFilter;

      const startingRate = getComparableRate(coach);
      const matchesRate =
        parsedMaxRate === undefined ||
        Number.isNaN(parsedMaxRate) ||
        (startingRate !== null && startingRate <= parsedMaxRate);

      const matchesRating = (coach.rating || 0) >= parsedMinRating;

      return (
        matchesSearchTerm && matchesServiceMode && matchesRate && matchesRating
      );
    });

    if (sortBy === "priceAsc") {
      next = [...next].sort((a, b) => {
        const rateA = getComparableRate(a);
        const rateB = getComparableRate(b);

        if (rateA === null && rateB === null) {
          return 0;
        }
        if (rateA === null) {
          return 1;
        }
        if (rateB === null) {
          return -1;
        }

        return rateA - rateB;
      });
    } else if (sortBy === "priceDesc") {
      next = [...next].sort((a, b) => {
        const rateA = getComparableRate(a);
        const rateB = getComparableRate(b);

        if (rateA === null && rateB === null) {
          return 0;
        }
        if (rateA === null) {
          return 1;
        }
        if (rateB === null) {
          return -1;
        }

        return rateB - rateA;
      });
    } else if (sortBy === "ratingDesc") {
      next = [...next].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "relevance") {
      next = [...next].sort(
        (a, b) =>
          getRelevanceScore(b, normalizedSearchTerm) -
          getRelevanceScore(a, normalizedSearchTerm),
      );
    }

    setFilteredCoaches(next);
  };

  useEffect(() => {
    applyCoachFilters(coaches);
  }, [
    coaches,
    appliedSportFilter,
    serviceModeFilter,
    maxRate,
    minRating,
    sortBy,
  ]);

  useEffect(() => {
    if (!hasHydratedFromUrlRef.current) {
      return;
    }

    const params = new URLSearchParams();

    if (appliedSportFilter) {
      params.set("sport", appliedSportFilter);
    }
    if (serviceModeFilter !== "ALL") {
      params.set("mode", serviceModeFilter);
    }
    if (maxRate) {
      params.set("maxRate", maxRate);
    }
    if (minRating !== "0") {
      params.set("minRating", minRating);
    }
    if (sortBy !== "relevance") {
      params.set("sort", sortBy);
    }
    if (showAdvancedFilters) {
      params.set("filters", "1");
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) {
      return;
    }

    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [
    appliedSportFilter,
    maxRate,
    minRating,
    pathname,
    router,
    searchParams,
    serviceModeFilter,
    showAdvancedFilters,
    sortBy,
  ]);

  useEffect(() => {
    if (hasRequestedInitialLoadRef.current) {
      return;
    }

    hasRequestedInitialLoadRef.current = true;
    requestLocationAndLoadCoaches();
  }, []);

  const loadCoaches = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const response = await discoveryApi.searchNearbyCoaches({
        latitude,
        longitude,
        maxDistance: 30000,
      });
      if (response.success && response.data) {
        setCoaches(response.data.coaches || []);
      }
    } catch (error) {
      console.error("Failed to load coaches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSportFilter(normalizeSearchTerm(sportInput));
  };

  const handleQuickSportFilter = (sport: string) => {
    setSportInput(sport);
    setAppliedSportFilter(normalizeSearchTerm(sport));
  };

  const handleClearFilters = () => {
    setSportInput("");
    setAppliedSportFilter("");
    setServiceModeFilter("ALL");
    setMaxRate("");
    setMinRating("0");
    setSortBy("relevance");
  };

  const handleClearSearch = () => {
    setSportInput("");
    setAppliedSportFilter("");
  };

  const handleRemoveFilter = (
    key: "sport" | "serviceMode" | "maxRate" | "minRating" | "sortBy",
  ) => {
    if (key === "sport") {
      handleClearSearch();
      return;
    }

    if (key === "serviceMode") {
      setServiceModeFilter("ALL");
      return;
    }

    if (key === "maxRate") {
      setMaxRate("");
      return;
    }

    if (key === "minRating") {
      setMinRating("0");
      return;
    }

    setSortBy("relevance");
  };

  const normalizedSportInput = normalizeSearchTerm(sportInput);
  const hasPendingSearchChange = normalizedSportInput !== appliedSportFilter;

  const activeCoachFilters: Array<{
    key: "sport" | "serviceMode" | "maxRate" | "minRating" | "sortBy";
    label: string;
  }> = [
    appliedSportFilter
      ? { key: "sport", label: `Sport: ${appliedSportFilter}` }
      : null,
    serviceModeFilter !== "ALL"
      ? {
          key: "serviceMode",
          label: `Mode: ${serviceModeFilter.replace("_", " ")}`,
        }
      : null,
    maxRate ? { key: "maxRate", label: `Max ₹${maxRate}` } : null,
    Number(minRating) > 0
      ? { key: "minRating", label: `Rating ${minRating}+` }
      : null,
    sortBy !== "relevance"
      ? {
          key: "sortBy",
          label:
            sortBy === "priceAsc"
              ? "Sort: Price Low-High"
              : sortBy === "priceDesc"
                ? "Sort: Price High-Low"
                : "Sort: Top Rated",
        }
      : null,
  ].filter(
    (
      filter,
    ): filter is {
      key: "sport" | "serviceMode" | "maxRate" | "minRating" | "sortBy";
      label: string;
    } => Boolean(filter),
  );

  const hasActiveCoachFilters = activeCoachFilters.length > 0;

  return (
    <div className="bg-slate-50">
      <Modal
        isOpen={Boolean(locationError)}
        onClose={() => {}}
        title="Location Access Required"
        closeButton={false}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleOpenLocationSettings}
            >
              Open Location Settings
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleTryLocationAgain}
            >
              Try Again
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          Location is necessary to find nearby coaches. Please enable location
          permission in your browser and try again.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
          <li>Open your browser site permissions for this page.</li>
          <li>Allow location access for this site.</li>
          <li>Come back and click Try Again.</li>
        </ul>
      </Modal>

      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Users size={32} className="text-turf-green" />
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  Professional Coaches
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                Find Expert Coaches
              </h1>
              <p className="text-slate-200 text-base sm:text-lg mb-6 max-w-2xl">
                Learn from experienced coaches. Browse and book training
                sessions with professionals in your favorite sports.
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
                    placeholder="Search by sport, coach name, or keyword..."
                    className="w-full rounded-lg border-2 border-slate-200 bg-white py-3 pl-10 pr-10 font-medium text-slate-900 focus:border-turf-green focus:outline-none focus:ring-2 focus:ring-turf-green/50"
                    aria-label="Search coaches by sport, coach name, or keyword"
                  />
                  {sportInput && (
                    <button
                      type="button"
                      onClick={() => setSportInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                      aria-label="Clear sport search input"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full px-8 shadow-lg sm:w-auto sm:whitespace-nowrap"
                  disabled={!sportInput.trim() && !appliedSportFilter}
                >
                  <Search size={18} className="mr-2" />
                  Search
                </Button>
                {appliedSportFilter && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClearSearch}
                    className="w-full sm:w-auto"
                  >
                    <FilterX size={16} className="mr-2" />
                    Clear
                  </Button>
                )}
              </form>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/70">
                  Quick filters
                </span>
                {QUICK_SPORT_FILTERS.map((sport) => {
                  const isActive =
                    appliedSportFilter === normalizeSearchTerm(sport);
                  return (
                    <button
                      key={sport}
                      type="button"
                      onClick={() => handleQuickSportFilter(sport)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                        isActive
                          ? "border-turf-green bg-turf-green text-white"
                          : "border-white/30 bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {sport}
                    </button>
                  );
                })}
              </div>

              {hasPendingSearchChange && (
                <p className="mt-2 text-xs text-white/80">
                  Search text changed. Press Search to apply new sport filter.
                </p>
              )}

              <div className="mt-5 max-w-6xl rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-xs">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                    Refine Results
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
                      {filteredCoaches.length} result
                      {filteredCoaches.length !== 1 ? "s" : ""}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowAdvancedFilters((prev) => !prev)}
                      className="px-3 py-1.5 text-xs"
                    >
                      <SlidersHorizontal size={14} className="mr-1.5" />
                      {showAdvancedFilters ? "Hide Filters" : "Show Filters"}
                    </Button>
                    {hasActiveCoachFilters && (
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
                </div>

                {showAdvancedFilters && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-white/75">
                        Service Mode
                      </span>
                      <select
                        value={serviceModeFilter}
                        onChange={(e) => setServiceModeFilter(e.target.value)}
                        className="w-full px-3 py-2.5 border border-white/20 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green"
                      >
                        <option value="ALL">All Service Modes</option>
                        <option value="OWN_VENUE">Own Venue</option>
                        <option value="FREELANCE">Freelance</option>
                        <option value="HYBRID">Hybrid</option>
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-white/75">
                        Max Rate
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={maxRate}
                        onChange={(e) => setMaxRate(e.target.value)}
                        placeholder="e.g. 1500"
                        className="w-full px-3 py-2.5 border border-white/20 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-white/75">
                        Minimum Rating
                      </span>
                      <select
                        value={minRating}
                        onChange={(e) => setMinRating(e.target.value)}
                        className="w-full px-3 py-2.5 border border-white/20 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green"
                      >
                        <option value="0">Any Rating</option>
                        <option value="3">3+ and above</option>
                        <option value="4">4+ and above</option>
                        <option value="4.5">4.5+ and above</option>
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-white/75">
                        Sort By
                      </span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full px-3 py-2.5 border border-white/20 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="priceAsc">Price: Low to High</option>
                        <option value="priceDesc">Price: High to Low</option>
                        <option value="ratingDesc">Rating: High to Low</option>
                      </select>
                    </label>
                  </div>
                )}

                {hasActiveCoachFilters && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeCoachFilters.map((filter) => (
                      <button
                        type="button"
                        key={filter.label}
                        onClick={() => handleRemoveFilter(filter.key)}
                        className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/30"
                        aria-label={`Remove ${filter.label} filter`}
                      >
                        {filter.label}
                        <X size={12} className="ml-1.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-turf-green/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-turf-green mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading coaches...</p>
          </div>
        ) : filteredCoaches.length === 0 ? (
          <Card className="bg-white">
            <div className="text-center py-16 bg-slate-50 rounded-lg">
              <Users size={56} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {appliedSportFilter
                  ? "No coaches found"
                  : "No coaches available"}
              </h3>
              <p className="text-slate-500 mb-6">
                {appliedSportFilter
                  ? `We couldn't find any coaches for "${appliedSportFilter}". Try a different sport.`
                  : locationError || "Check back soon for new coaches."}
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
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  {appliedSportFilter
                    ? `${appliedSportFilter} Coaches`
                    : "All Coaches"}
                </h2>
                <p className="text-slate-600 mt-1">
                  {filteredCoaches.length} coach
                  {filteredCoaches.length !== 1 ? "es" : ""} available
                </p>
              </div>
            </div>

            {/* Coaches Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredCoaches.map((coach, coachIndex) => {
                const coachCardKey =
                  coach.id ||
                  coach._id ||
                  `${String(coach.userId)}-${coachIndex}`;
                const startingRate = Number(getStartingRate(coach));
                const hasStartingRate =
                  Number.isFinite(startingRate) && startingRate > 0;
                const primarySport = getPrimarySport(coach);
                const additionalSportsCount = getAdditionalSportsCount(coach);
                const coachRoute = `/coaches/${coach.id || coach._id}`;
                const onOpenCoach = () => router.push(coachRoute);

                return (
                  <Card
                    key={coachCardKey}
                    className="group flex h-full cursor-pointer flex-col overflow-hidden border-2 border-slate-100 bg-white transition-all hover:-translate-y-0.5 hover:border-turf-green hover:shadow-xl focus-within:border-turf-green focus-within:shadow-xl"
                    onClick={onOpenCoach}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenCoach();
                      }
                    }}
                    aria-label={`View coach profile for ${getCoachDisplayName(coach)}`}
                  >
                    {(() => {
                      const coachImageCandidates =
                        getCoachImageCandidates(coach);
                      const venueImage = getCoachVenueImage(coach);
                      const coachName = getCoachDisplayName(coach);
                      const coachInitials = getCoachInitials(coach);

                      return (
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                          <CoachImageWithFallback
                            sources={coachImageCandidates}
                            alt={coachName}
                            fallbackLabel={coachInitials}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />

                          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/50 to-transparent" />
                          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-800">
                            {primarySport}
                          </span>

                          {venueImage && (
                            <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Venue image
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    <div className="border-b border-slate-100 bg-linear-to-br from-turf-green/5 to-slate-50 p-5">
                      <div className="mb-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Award
                            size={18}
                            className="shrink-0 text-turf-green"
                          />
                          <h3 className="line-clamp-1 min-h-6 flex-1 text-base font-bold text-slate-900">
                            {getCoachDisplayName(coach)}
                          </h3>
                          {(() => {
                            const badge = getVerificationBadge(coach);
                            return (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="line-clamp-1 min-h-5 text-xs text-slate-600">
                          {getCoachSportsSummary(coach)}
                        </p>
                        {additionalSportsCount > 0 && (
                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                            +{additionalSportsCount} more sport
                            {additionalSportsCount !== 1 ? "s" : ""}
                          </p>
                        )}
                        <p className="mt-1 line-clamp-2 min-h-10 text-xs text-slate-500">
                          {getCoachBioSummary(coach)}
                        </p>
                      </div>

                      {/* Rating */}
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/80 p-2">
                        <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Star
                              size={14}
                              className="fill-yellow-500 text-yellow-500"
                            />
                            <span className="text-sm font-bold text-slate-900">
                              {getDisplayRating(coach)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                            Rating
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                          <p className="line-clamp-1 text-[11px] font-semibold text-slate-800">
                            {getDisplayReviewCount(coach)}
                          </p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                            Reviews
                          </p>
                        </div>

                        <div className="rounded-lg bg-turf-green/10 px-2 py-1.5 text-center">
                          <p className="line-clamp-1 text-[11px] font-semibold uppercase tracking-wide text-turf-green">
                            {getServiceModeLabel(coach)}
                          </p>
                          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
                            Mode
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto p-5">
                      {/* Price */}
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Starting from
                        </p>
                        {hasStartingRate ? (
                          <p className="mt-0.5 flex items-center gap-1 text-xl font-bold text-turf-green">
                            <IndianRupee size={18} />
                            {startingRate}
                            <span className="text-xs font-medium text-slate-500">
                              / hour
                            </span>
                          </p>
                        ) : (
                          <p className="mt-0.5 text-sm font-semibold text-slate-600">
                            Contact for pricing
                          </p>
                        )}

                        <Button
                          variant="primary"
                          size="sm"
                          className="mt-3 w-full bg-turf-green hover:bg-green-700 group-hover:shadow-lg transition-shadow"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCoach();
                          }}
                        >
                          View Profile & Book
                          <ArrowRight size={16} className="ml-1" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CoachesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-turf-green mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading coaches...</p>
            </div>
          </div>
        </div>
      }
    >
      <CoachesPageContent />
    </Suspense>
  );
}
