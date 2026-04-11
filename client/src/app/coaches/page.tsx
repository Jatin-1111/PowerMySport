"use client";

import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import {
  StaggerContainer,
  StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import { Coach } from "@/types";
import {
  ArrowRight,
  Award,
  FilterX,
  ImageIcon,
  IndianRupee,
  MapPin,
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

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) => {
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const formatDistanceKm = (distanceKm: number) => {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return "";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
};

const parseCoordinates = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    coordinates?: unknown;
    lat?: unknown;
    lng?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  };

  if (
    Array.isArray(candidate.coordinates) &&
    candidate.coordinates.length === 2
  ) {
    const longitude = Number(candidate.coordinates[0]);
    const latitude = Number(candidate.coordinates[1]);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return { latitude, longitude };
    }
  }

  const latitude = Number(candidate.latitude ?? candidate.lat);
  const longitude = Number(candidate.longitude ?? candidate.lng);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  return null;
};

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
const SORT_OPTIONS = [
  "relevance",
  "nearest",
  "priceAsc",
  "priceDesc",
  "ratingDesc",
];

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
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [hasLocationAccessDenied, setHasLocationAccessDenied] = useState(false);
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

  const getCoachCoordinates = (coach: Coach) => {
    const coachWithLegacyLocation = coach as Coach & {
      location?: unknown;
      effectiveLocation?: unknown;
    };

    const coordinateCandidates: unknown[] = [
      coach.ownVenueDetails?.location,
      coach.baseLocation,
      coachWithLegacyLocation.location,
      coachWithLegacyLocation.effectiveLocation,
    ];

    for (const locationCandidate of coordinateCandidates) {
      const parsed = parseCoordinates(locationCandidate);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  };

  const getDistanceFromUserKm = (coach: Coach) => {
    if (!userLocation) {
      return null;
    }

    const coachCoordinates = getCoachCoordinates(coach);
    if (!coachCoordinates) {
      return null;
    }

    return calculateDistanceKm(userLocation, coachCoordinates);
  };

  const getCoachServingCity = (coach: Coach) => {
    const fullAddress = coach.ownVenueDetails?.address;
    if (typeof fullAddress !== "string") {
      return "";
    }

    const parts = fullAddress
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return "";
    }

    if (parts.length === 1) {
      return parts[0];
    }

    if (parts.length === 2) {
      return parts[0];
    }

    return parts[parts.length - 3] || "";
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
    } else if (sortBy === "nearest") {
      next = [...next].sort((a, b) => {
        const distanceA = getDistanceFromUserKm(a);
        const distanceB = getDistanceFromUserKm(b);

        if (distanceA === null && distanceB === null) {
          return (
            getRelevanceScore(b, normalizedSearchTerm) -
            getRelevanceScore(a, normalizedSearchTerm)
          );
        }

        if (distanceA === null) {
          return 1;
        }

        if (distanceB === null) {
          return -1;
        }

        return distanceA - distanceB;
      });
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
    userLocation,
  ]);

  useEffect(() => {
    if (sortBy !== "nearest") {
      return;
    }

    if (userLocation) {
      return;
    }

    if (!navigator.geolocation) {
      setHasLocationAccessDenied(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setHasLocationAccessDenied(false);
      },
      () => {
        setHasLocationAccessDenied(true);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }, [sortBy, userLocation]);

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
    loadCoaches(appliedSportFilter);
  }, [appliedSportFilter]);

  const loadCoaches = async (sportFilter: string = "") => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (sportFilter) {
        params.sport = sportFilter;
      }
      const response = await discoveryApi.searchNearbyCoaches(params);
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
            sortBy === "nearest"
              ? "Sort: Nearest"
              : sortBy === "priceAsc"
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
  const nearestSortableCoachCount =
    sortBy === "nearest"
      ? filteredCoaches.filter((coach) => getDistanceFromUserKm(coach) !== null)
          .length
      : 0;

  return (
    <div className="bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header Section */}
      <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
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
                    className="w-full rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 pl-10 pr-10 font-medium text-slate-900 dark:text-slate-100 focus:border-turf-green focus:outline-none focus:ring-2 focus:ring-turf-green/50 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
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
                        className="w-full px-3 py-2.5 border border-white/20 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green transition-colors"
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
                        className="w-full px-3 py-2.5 border border-white/20 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-white/75">
                        Minimum Rating
                      </span>
                      <select
                        value={minRating}
                        onChange={(e) => setMinRating(e.target.value)}
                        className="w-full px-3 py-2.5 border border-white/20 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green transition-colors"
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
                        className="w-full px-3 py-2.5 border border-white/20 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green transition-colors"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="nearest">Nearest</option>
                        <option value="priceAsc">Price: Low to High</option>
                        <option value="priceDesc">Price: High to Low</option>
                        <option value="ratingDesc">Rating: High to Low</option>
                      </select>
                    </label>
                  </div>
                )}

                {sortBy === "nearest" && hasLocationAccessDenied && (
                  <p className="mt-3 text-xs text-white/80">
                    Location access is off. Showing all coaches with available
                    data.
                  </p>
                )}

                {sortBy === "nearest" &&
                  userLocation &&
                  !hasLocationAccessDenied &&
                  nearestSortableCoachCount === 0 && (
                    <p className="mt-3 text-xs text-white/80">
                      Nearest sort is active, but no coach location coordinates
                      are available yet. Showing all coaches in fallback order.
                    </p>
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
            <p className="text-slate-600 dark:text-slate-400 font-medium">Loading coaches...</p>
          </div>
        ) : filteredCoaches.length === 0 ? (
          <Card className="bg-white dark:bg-slate-900 border-none">
            <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <Users size={56} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {appliedSportFilter
                  ? "No coaches found"
                  : "No coaches available"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                {appliedSportFilter
                  ? `We couldn't find any coaches for "${appliedSportFilter}". Try a different sport.`
                  : "Check back soon for new coaches."}
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
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
                  {appliedSportFilter
                    ? `${appliedSportFilter} Coaches`
                    : "All Coaches"}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  {filteredCoaches.length} coach
                  {filteredCoaches.length !== 1 ? "es" : ""} available
                </p>
              </div>
            </div>

            {/* Coaches Grid */}
            <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                const distanceFromUserKm = getDistanceFromUserKm(coach);
                const showNearestDistance =
                  sortBy === "nearest" &&
                  userLocation !== null &&
                  distanceFromUserKm !== null;
                const coachRoute = `/coaches/${coach.id || coach._id}`;
                const onOpenCoach = () => router.push(coachRoute);

                return (                  
                  <StaggerItem key={coachCardKey} className="h-full">
                  <Card
                    className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-turf-green/40 dark:hover:border-turf-green/30 hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.3)] focus-within:-translate-y-1.5 focus-within:border-turf-green/40 focus-within:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] glass-panel"
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
                      const servingCity = getCoachServingCity(coach);
                      const badge = getVerificationBadge(coach);

                      return (
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                          <CoachImageWithFallback
                            sources={coachImageCandidates}
                            alt={coachName}
                            fallbackLabel={coachInitials}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />

                          {/* Elegant gradient overlay for perfect legibility */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-95" />

                          {/* Top Badges */}
                          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-2">
                            <div className="flex flex-col items-start gap-2">
                              {venueImage && (
                                <span className="inline-flex items-center rounded-lg border border-white/20 bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
                                  Venue Photo
                                </span>
                              )}
                              <span className="inline-flex items-center rounded-lg bg-turf-green px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                                {primarySport}
                              </span>
                            </div>
                            {badge.label === "Verified" && (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-500/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
                                <Award size={12} className="text-white" />
                                Verified
                              </span>
                            )}
                          </div>

                          {/* Coach Intro - Bottom anchored inside image */}
                          <div className="absolute bottom-0 left-0 right-0 p-5">
                            <h3 className="line-clamp-1 text-2xl font-extrabold tracking-tight text-white drop-shadow-md">
                              {coachName}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-white/90">
                              {servingCity && (
                                <span className="flex items-center gap-1.5 drop-shadow-sm">
                                  <MapPin size={14} className="text-white/70" />
                                  {servingCity}
                                </span>
                              )}
                              {showNearestDistance && (
                                <span className="flex items-center gap-1.5 font-semibold text-turf-green drop-shadow-sm">
                                  <span className="h-1 w-1 rounded-full bg-turf-green" />
                                  {formatDistanceKm(distanceFromUserKm)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-1 flex-col p-5">
                      {/* Bio & Extra Sports */}
                      <div className="mb-5">
                        <p className="line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {getCoachBioSummary(coach)}
                        </p>
                        {additionalSportsCount > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {coach.sports
                              .filter((s) => s !== primarySport)
                              .map((s) => (
                                <span
                                  key={s}
                                  className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                                >
                                  {s}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Stat Pills */}
                      <div className="mt-auto grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-2.5 transition-colors group-hover:border-amber-100 group-hover:bg-amber-50/50 dark:group-hover:bg-amber-900/10 dark:group-hover:border-amber-900/30">
                          <div className="flex items-center gap-1.5">
                            <Star
                              size={14}
                              className="fill-amber-400 text-amber-400"
                            />
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {getDisplayRating(coach)}
                            </span>
                          </div>
                          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Rating
                          </span>
                        </div>

                        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-2.5 transition-colors group-hover:border-blue-100 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 dark:group-hover:border-blue-900/30">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {(() => {
                              const r = parseInt(getDisplayReviewCount(coach));
                              return isNaN(r) ? "New" : r;
                            })()}
                          </span>
                          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Reviews
                          </span>
                        </div>

                        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 p-2.5 transition-colors group-hover:border-turf-green/10 group-hover:bg-turf-green/5 dark:group-hover:bg-turf-green/10 dark:group-hover:border-turf-green/20">
                          <span className="line-clamp-1 text-[11px] font-bold text-slate-900 dark:text-slate-100">
                            {getServiceModeLabel(coach)}
                          </span>
                          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Mode
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Minimal Footer */}
                    <div className="border-t border-slate-100/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/50 p-4 px-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Session Price
                          </p>
                          {hasStartingRate ? (
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                                ₹{startingRate}
                              </span>
                              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                /hr
                              </span>
                            </div>
                          ) : (
                            <p className="mt-0.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                              Contact Us
                            </p>
                          )}
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm transition-all duration-300 group-hover:-rotate-45 group-hover:bg-turf-green dark:group-hover:bg-turf-green group-hover:text-white dark:group-hover:text-white group-hover:shadow-md">
                          <ArrowRight size={18} strokeWidth={2.5} />
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

export default function CoachesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-turf-green mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Loading coaches...</p>
            </div>
          </div>
        </div>
      }
    >
      <CoachesPageContent />
    </Suspense>
  );
}
