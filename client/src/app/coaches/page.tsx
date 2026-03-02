"use client";

import { discoveryApi } from "@/modules/discovery/services/discovery";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach } from "@/types";
import {
  ArrowRight,
  Award,
  ImageIcon,
  IndianRupee,
  Search,
  Star,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

const CoachImageWithFallback = ({
  sources,
  alt,
  className,
}: {
  sources: string[];
  alt: string;
  className: string;
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
      <div className="flex h-full w-full items-center justify-center text-slate-400">
        <ImageIcon size={28} />
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

export default function CoachesPage() {
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);
  const [sportInput, setSportInput] = useState("");
  const [appliedSportFilter, setAppliedSportFilter] = useState("");
  const [serviceModeFilter, setServiceModeFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");
  const [maxRate, setMaxRate] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [locationError, setLocationError] = useState("");
  const router = useRouter();

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
          label: "Unverified",
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

  const applyCoachFilters = (baseCoaches: Coach[]) => {
    const parsedMaxRate = maxRate ? Number(maxRate) : undefined;
    const parsedMinRating = Number(minRating || 0);

    let next = baseCoaches.filter((coach) => {
      const status =
        coach.verificationStatus ||
        (coach.isVerified ? "VERIFIED" : "UNVERIFIED");
      const matchesSport =
        !appliedSportFilter ||
        coach.sports.some((sport) =>
          sport.toLowerCase().includes(appliedSportFilter.toLowerCase()),
        );

      const matchesServiceMode =
        serviceModeFilter === "ALL" || coach.serviceMode === serviceModeFilter;

      const matchesVerification =
        verificationFilter === "ALL" || status === verificationFilter;

      const startingRate = getStartingRate(coach);
      const matchesRate =
        parsedMaxRate === undefined ||
        Number.isNaN(parsedMaxRate) ||
        startingRate <= parsedMaxRate;

      const matchesRating = (coach.rating || 0) >= parsedMinRating;

      return (
        matchesSport &&
        matchesServiceMode &&
        matchesVerification &&
        matchesRate &&
        matchesRating
      );
    });

    if (sortBy === "priceAsc") {
      next = [...next].sort((a, b) => getStartingRate(a) - getStartingRate(b));
    } else if (sortBy === "priceDesc") {
      next = [...next].sort((a, b) => getStartingRate(b) - getStartingRate(a));
    } else if (sortBy === "ratingDesc") {
      next = [...next].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    setFilteredCoaches(next);
  };

  useEffect(() => {
    applyCoachFilters(coaches);
  }, [
    coaches,
    appliedSportFilter,
    serviceModeFilter,
    verificationFilter,
    maxRate,
    minRating,
    sortBy,
  ]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Location is required to discover nearby coaches.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await loadCoaches(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocationError(
          "Please enable location to see coaches in your range.",
        );
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
  }, []);

  const loadCoaches = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const response = await discoveryApi.searchNearby({
        latitude,
        longitude,
      });
      if (response.success && response.data) {
        setCoaches(response.data.coaches);
      }
    } catch (error) {
      console.error("Failed to load coaches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSportFilter(sportInput.trim());
  };

  const handleClearFilters = () => {
    setSportInput("");
    setAppliedSportFilter("");
    setServiceModeFilter("ALL");
    setVerificationFilter("ALL");
    setMaxRate("");
    setMinRating("0");
    setSortBy("relevance");
  };

  const activeCoachFilters = [
    appliedSportFilter ? `Sport: ${appliedSportFilter}` : null,
    serviceModeFilter !== "ALL"
      ? `Mode: ${serviceModeFilter.replace("_", " ")}`
      : null,
    verificationFilter !== "ALL"
      ? `Verification: ${verificationFilter.replace("_", " ")}`
      : null,
    maxRate ? `Max ₹${maxRate}` : null,
    Number(minRating) > 0 ? `Rating ${minRating}★+` : null,
    sortBy !== "relevance"
      ? sortBy === "priceAsc"
        ? "Sort: Price Low-High"
        : sortBy === "priceDesc"
          ? "Sort: Price High-Low"
          : "Sort: Top Rated"
      : null,
  ].filter(Boolean) as string[];

  const hasActiveCoachFilters = activeCoachFilters.length > 0;

  return (
    <div className="bg-slate-50">
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
                    placeholder="Search by sport (e.g. Cricket, Tennis, Basketball)..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green bg-white text-slate-900 font-medium"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  className="whitespace-nowrap px-8 shadow-lg"
                >
                  <Search size={18} className="mr-2" />
                  Apply Sport
                </Button>
              </form>

              <div className="mt-5 max-w-6xl rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-xs">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                    Refine Results
                  </p>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                      Verification
                    </span>
                    <select
                      value={verificationFilter}
                      onChange={(e) => setVerificationFilter(e.target.value)}
                      className="w-full px-3 py-2.5 border border-white/20 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green"
                    >
                      <option value="ALL">All Verification</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="PENDING">Pending</option>
                      <option value="REVIEW">In Review</option>
                      <option value="UNVERIFIED">Unverified</option>
                      <option value="REJECTED">Rejected</option>
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
                      <option value="3">3★ and above</option>
                      <option value="4">4★ and above</option>
                      <option value="4.5">4.5★ and above</option>
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

                {hasActiveCoachFilters && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeCoachFilters.map((filter) => (
                      <span
                        key={filter}
                        className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white"
                      >
                        {filter}
                      </span>
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
                <h2 className="text-2xl font-bold text-slate-900">
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
                  coach.id || coach._id || `${String(coach.userId)}-${coachIndex}`;

                return (
                <Card
                  key={coachCardKey}
                  className="bg-white border-2 border-slate-100 hover:border-turf-green hover:shadow-xl transition-all overflow-hidden group cursor-pointer"
                  onClick={() =>
                    router.push(`/coaches/${coach.id || coach._id}`)
                  }
                >
                  {(() => {
                    const coachImageCandidates = getCoachImageCandidates(coach);
                    const venueImage = getCoachVenueImage(coach);

                    return (
                      <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                        <CoachImageWithFallback
                          sources={coachImageCandidates}
                          alt={`${coach.sports[0]} coach`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />

                        {venueImage && (
                          <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Venue image
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-5 border-b border-slate-100">
                    <div className="mb-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Award size={20} className="text-turf-green" />
                        <h3 className="text-lg font-bold text-slate-900">
                          {coach.sports[0]} Coach
                        </h3>
                        {(() => {
                          const badge = getVerificationBadge(coach);
                          return (
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-slate-600">
                        {coach.sports.join(", ")}
                      </p>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star
                            size={18}
                            className="text-yellow-500 fill-yellow-500"
                          />
                          <span className="font-bold text-slate-900">
                            {coach.rating.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          ({coach.reviewCount} reviews)
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-turf-green/10 border border-turf-green/30 rounded-lg text-turf-green font-semibold text-xs">
                        {coach.serviceMode}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Bio */}
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {coach.bio ||
                        "Expert coach offering professional training sessions to help you improve your skills."}
                    </p>

                    {/* Price */}
                    <div className="pt-4 border-t border-slate-100">
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {coach.sports.slice(0, 3).map((sport, sportIndex) => (
                          <span
                            key={`${coachCardKey}-${sport}-${sportIndex}`}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            {sport}: ₹{getSportRate(coach, sport)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                            Starting from
                          </p>
                          <p className="text-xl font-bold text-turf-green flex items-center gap-1 mt-0.5">
                            <IndianRupee size={18} />
                            {getStartingRate(coach)}
                          </p>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-turf-green hover:bg-green-700 group-hover:shadow-lg transition-shadow"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/coaches/${coach.id || coach._id}`);
                          }}
                        >
                          Book
                          <ArrowRight size={16} className="ml-1" />
                        </Button>
                      </div>
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
