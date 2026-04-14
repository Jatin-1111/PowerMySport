"use client";

import { toast } from "@/lib/toast";
import { getCommunityAppUrl } from "@/lib/community/url";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { CommunityInsightsCard } from "@/modules/community/components/CommunityInsightsCard";
import { buildCoachCommunityIntent } from "@/modules/community/utils/coachCommunityIntent";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { reviewApi } from "@/modules/review/services/review";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Availability, Coach, ReviewItem, ReviewSummary } from "@/types";
import {
  ArrowLeft,
  Award,
  Calendar,
  Check,
  ImageIcon,
  IndianRupee,
  Info,
  Star,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
  iconClassName,
}: {
  sources: string[];
  alt: string;
  className: string;
  iconClassName: string;
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
      <div className={iconClassName}>
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

export default function CoachDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const coachId = params.coachId as string;

  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary>({
    averageRating: 0,
    reviewCount: 0,
  });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [eligibleBookingId, setEligibleBookingId] = useState<string | null>(
    null,
  );
  const [reviewEligibilityReason, setReviewEligibilityReason] = useState("");
  const communityIntent = buildCoachCommunityIntent({
    source: "coach_detail",
    selectedSport,
    coachSports: coach?.sports,
    coachId,
  });
  const communityUrl = getCommunityAppUrl({
    path: "q",
    searchParams: {
      ask: "1",
      q: communityIntent.q,
      sport: communityIntent.sport,
      utm_source: "powermysport",
      utm_medium: "community_cta",
      utm_campaign: "coach_detail",
    },
  });

  const getSportRate = (sport: string) => {
    if (!coach) {
      return 0;
    }
    const sportRate = coach.sportPricing?.[sport];
    if (typeof sportRate === "number" && sportRate > 0) {
      return sportRate;
    }
    return coach.hourlyRate;
  };

  const getCoachImageCandidates = (coachData: Coach) => {
    const coachUser =
      typeof coachData.userId === "object" && coachData.userId !== null
        ? coachData.userId
        : undefined;

    return [
      coachData.photoUrl,
      coachData.profileImage,
      coachUser?.photoUrl,
      coachData.ownVenueDetails?.images?.[0],
    ].filter((value): value is string => typeof value === "string");
  };

  const getVenueImages = (coachData: Coach) => {
    return (coachData.ownVenueDetails?.images || [])
      .map((value) => normalizeImageUrl(value))
      .filter((value): value is string => value.length > 0);
  };

  const getVerificationBadge = (coachData: Coach) => {
    const status =
      coachData.verificationStatus ||
      (coachData.isVerified ? "VERIFIED" : "UNVERIFIED");

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

  const getCertificationCount = (coachData: Coach) => {
    return (coachData.certifications || []).filter(
      (value) => typeof value === "string" && value.trim().length > 0,
    ).length;
  };

  const loadCoachDetails = useCallback(async () => {
    try {
      const response = await discoveryApi.getCoachById(coachId);
      if (response.success && response.data) {
        setCoach(response.data);
        if (response.data.sports && response.data.sports.length > 0) {
          setSelectedSport(response.data.sports[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load coach details:", error);
      toast.error("Failed to load coach details");
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const loadAvailability = useCallback(async () => {
    setAvailabilityLoading(true);
    try {
      const response = await bookingApi.getCoachAvailability(
        coachId,
        selectedDate,
        selectedSport || undefined,
      );
      if (response.success && response.data) {
        setAvailability(response.data);
      } else {
        setAvailability({ availableSlots: [], bookedSlots: [] });
      }
    } catch (error) {
      console.error("Failed to load availability:", error);
      setAvailability({ availableSlots: [], bookedSlots: [] });
    } finally {
      setAvailabilityLoading(false);
    }
  }, [coachId, selectedDate, selectedSport]);

  useEffect(() => {
    if (coachId) {
      loadCoachDetails();
    }
  }, [coachId, loadCoachDetails]);

  useEffect(() => {
    if (coachId && selectedDate) {
      loadAvailability();
    }
  }, [coachId, selectedDate, selectedSport, loadAvailability]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedSport, selectedDate]);

  useEffect(() => {
    if (coachId) {
      loadReviews();
    }
  }, [coachId]);

  useEffect(() => {
    if (coachId && user?.id) {
      loadReviewEligibility();
    } else {
      setEligibleBookingId(null);
      setReviewEligibilityReason("");
    }
  }, [coachId, user?.id, reviews.length]);

  const loadReviews = async () => {
    setReviewLoading(true);
    try {
      const response = await reviewApi.getCoachReviews(coachId, 1, 20);
      if (response.success && response.data) {
        setReviews(response.data.reviews || []);
        setReviewSummary(
          response.data.summary || { averageRating: 0, reviewCount: 0 },
        );
      }
    } catch (error) {
      console.error("Failed to load coach reviews:", error);
    } finally {
      setReviewLoading(false);
    }
  };

  const loadReviewEligibility = async () => {
    try {
      const response = await reviewApi.getReviewEligibility({
        targetType: "COACH",
        targetId: coachId,
      });

      if (response.success && response.data) {
        setEligibleBookingId(
          response.data.eligible ? response.data.bookingId : null,
        );
        setReviewEligibilityReason(response.data.reason || "");
      }
    } catch {
      setEligibleBookingId(null);
      setReviewEligibilityReason(
        "Unable to verify review eligibility right now",
      );
    }
  };

  const handleSubmitReview = async () => {
    if (!user) {
      router.push(`/login?redirect=/coaches/${coachId}`);
      return;
    }

    if (!eligibleBookingId) {
      toast.error("No eligible completed booking found for review");
      return;
    }

    if (!reviewRating) {
      toast.error("Please select a rating");
      return;
    }

    setReviewSubmitting(true);
    try {
      const response = await reviewApi.createReview({
        bookingId: eligibleBookingId,
        targetType: "COACH",
        targetId: coachId,
        rating: reviewRating,
        ...(reviewText.trim() ? { review: reviewText.trim() } : {}),
      });

      if (response.success) {
        toast.success("Review submitted successfully");
        setReviewRating(0);
        setReviewText("");
        setEligibleBookingId(null);
        await Promise.all([loadReviews(), loadCoachDetails()]);
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to submit review",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleBooking = async () => {
    if (!user) {
      router.push("/login?redirect=/coaches/" + coachId);
      return;
    }

    if (!selectedSlot || !selectedSport) {
      toast.error("Please select a sport and time slot");
      return;
    }

    setBookingLoading(true);
    try {
      const params = new URLSearchParams({
        type: "coach",
        coachId,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        sport: selectedSport,
      });

      router.push(`/dashboard/checkout?${params.toString()}`);
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-power-orange"></div>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h1 className="text-2xl font-bold mb-4">Coach not found</h1>
        <Link href="/coaches">
          <Button variant="outline">Back to Coaches</Button>
        </Link>
      </div>
    );
  }

  const selectedSportRate = getSportRate(selectedSport || coach.sports?.[0]);
  const coachImageCandidates = getCoachImageCandidates(coach);
  const venueImages = getVenueImages(coach);
  const coachUserName =
    typeof coach.userId === "object" && coach.userId?.name
      ? coach.userId.name
      : "";
  const coachDisplayName =
    coachUserName || `${coach.sports?.[0] || "Professional"} Coach`;
  const highlightedSports = coach.sports.slice(0, 6);
  const additionalSportsCount = Math.max(coach.sports.length - 6, 0);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f5f8ff_48%,#fff7ea_100%)]">
      {/* Header Section */}
      <div className="border-b border-white/60 bg-white/72 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Breadcrumbs */}
          <div className="mb-3">
            <Breadcrumbs
              items={[
                { label: "Browse Coaches", href: "/coaches" },
                { label: coachDisplayName },
              ]}
            />
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-[linear-gradient(120deg,#f8fbff_0%,#e5f1ff_38%,#fff4e2_100%)] p-6 text-slate-900 shadow-sm sm:p-8">
            <div className="relative z-10">
              {/* Back button */}
              <Link
                href="/coaches"
                className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="text-sm font-medium">Back to All Coaches</span>
              </Link>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-600">
                      Coach Profile
                    </span>
                    <span className="inline-flex items-center rounded-full border border-turf-green/30 bg-turf-green/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-turf-green">
                      {coach.serviceMode}
                    </span>
                    {(() => {
                      const badge = getVerificationBadge(coach);
                      return (
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                    {additionalSportsCount > 0 && (
                      <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-600">
                        +{additionalSportsCount} sports
                      </span>
                    )}
                  </div>

                  <h1 className="font-title mb-2 max-w-5xl wrap-break-word text-2xl font-bold leading-tight sm:text-4xl">
                    {coachDisplayName}
                  </h1>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {highlightedSports.map((sport, index) => (
                      <span
                        key={`${sport}-${index}`}
                        className="inline-flex max-w-full items-center rounded-md border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                        title={sport}
                      >
                        <span className="line-clamp-1 wrap-break-word">
                          {sport}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                    <div className="flex items-center gap-2">
                      <Star
                        size={20}
                        className="text-yellow-400 fill-yellow-400"
                      />
                      <span className="font-bold text-lg">
                        {coach.rating.toFixed(1)}
                      </span>
                      <span className="text-slate-600 text-sm">
                        ({coach.reviewCount} reviews)
                      </span>
                    </div>
                    <div className="hidden h-4 w-px bg-slate-600 sm:block"></div>
                    <div className="flex items-center gap-1">
                      <IndianRupee size={20} className="text-turf-green" />
                      <span className="font-bold text-xl text-turf-green">
                        {selectedSportRate}
                      </span>
                      <span className="text-slate-600 text-sm">/hour</span>
                    </div>
                  </div>
                </div>

                <div className="w-fit rounded-2xl border border-white/70 bg-white/80 p-2 backdrop-blur-md">
                  <div className="h-24 w-24 overflow-hidden rounded-xl border border-white/70 bg-white/80">
                    <CoachImageWithFallback
                      sources={coachImageCandidates}
                      alt={`${coach.sports[0]} coach`}
                      className="h-full w-full object-cover"
                      iconClassName="flex h-full w-full items-center justify-center text-white/70"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-turf-green/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About the Coach */}
            <Card className="premium-shadow overflow-hidden rounded-3xl border border-slate-200/70 bg-white/92 p-0 backdrop-blur-sm">
              <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Info size={24} className="text-turf-green" />
                  About the Coach
                </h2>
              </div>
              <div className="p-6">
                <p className="text-slate-700 leading-relaxed text-base">
                  {coach.bio ||
                    "Expert coach offering professional training sessions to help you improve your skills."}
                </p>
              </div>
            </Card>

            <CommunityInsightsCard
              title="Ask players about this coach"
              description="Check community recommendations on coaching style, progression quality, and best-fit sessions."
              q={communityIntent.q}
              sport={communityIntent.sport}
              ctaUrl={communityUrl}
              ctaTracking={{
                eventName: "community_cta_click",
                entityType: "COACH",
                entityId: coachId,
                metadata: {
                  ...communityIntent.analyticsMetadata,
                  page: "coach_detail",
                },
              }}
              enabled={Boolean(
                user && (user.role === "PLAYER" || user.role === "COACH"),
              )}
            />

            {/* Venue Images */}
            {venueImages.length > 0 && (
              <Card className="premium-shadow overflow-hidden rounded-3xl border border-slate-200/70 bg-white/92 p-0 backdrop-blur-sm">
                <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <ImageIcon size={24} className="text-turf-green" />
                    Venue Images
                  </h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {venueImages.map((imageUrl, index) => (
                      <div
                        key={`${imageUrl}-${index}`}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={imageUrl}
                          alt={`Venue image ${index + 1}`}
                          className="h-44 w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Certifications */}
            <Card className="premium-shadow overflow-hidden rounded-3xl border border-slate-200/70 bg-white/92 p-0 backdrop-blur-sm">
              <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Award size={24} className="text-turf-green" />
                  Certification & Verification
                </h2>
              </div>
              <div className="p-6">
                {(() => {
                  const badge = getVerificationBadge(coach);
                  const certificationCount = getCertificationCount(coach);

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-sm text-slate-700">
                          {certificationCount > 0
                            ? `${certificationCount} credential${certificationCount !== 1 ? "s" : ""} on file`
                            : "No public credential details"}
                        </span>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-700">
                          For privacy and security, individual certificate files
                          are not displayed on public profiles.
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          This section shows verification trust signals only.
                        </p>
                      </div>

                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                        <li>
                          Verification status reflects platform review state.
                        </li>
                        <li>
                          Credential documents are retained for internal checks.
                        </li>
                        <li>Sensitive documents are never exposed publicly.</li>
                      </ul>
                    </div>
                  );
                })()}
              </div>
            </Card>

            {/* Reviews */}
            <Card className="premium-shadow overflow-hidden rounded-3xl border border-slate-200/70 bg-white/92 p-0 backdrop-blur-sm">
              <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">
                  Coach Reviews
                </h2>
                <p className="text-sm text-slate-600 mt-1 inline-flex items-center gap-1">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" />
                  {reviewSummary.averageRating.toFixed(1)} average ·{" "}
                  {reviewSummary.reviewCount} reviews
                </p>
              </div>
              <div className="p-6">
                {user && eligibleBookingId && (
                  <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
                    <p className="text-sm font-semibold text-slate-800 mb-3">
                      Share your experience
                    </p>
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-0.5"
                        >
                          <Star
                            size={20}
                            className={
                              star <= reviewRating
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-slate-300"
                            }
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Write your review (optional)"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-turf-green/40"
                    />
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="primary"
                        className="bg-turf-green hover:bg-green-700"
                        onClick={handleSubmitReview}
                        disabled={reviewSubmitting || reviewRating === 0}
                      >
                        {reviewSubmitting ? "Submitting..." : "Submit Review"}
                      </Button>
                    </div>
                  </div>
                )}

                {user && !eligibleBookingId && (
                  <p className="mb-4 text-sm text-slate-500">
                    {reviewEligibilityReason ||
                      "Complete a session with this coach to add a review."}
                  </p>
                )}

                {reviewLoading ? (
                  <div className="text-sm text-slate-500">
                    Loading reviews...
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No reviews yet. Be the first to review this coach.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => {
                      const reviewer =
                        typeof review.userId === "object" &&
                        review.userId !== null
                          ? review.userId
                          : null;

                      return (
                        <div
                          key={String(review._id || review.id)}
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-slate-900 text-sm">
                              {reviewer?.name || "User"}
                            </p>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <Star
                                  key={index}
                                  size={14}
                                  className={
                                    index < review.rating
                                      ? "text-yellow-500 fill-yellow-500"
                                      : "text-slate-300"
                                  }
                                />
                              ))}
                            </div>
                          </div>
                          {review.review && (
                            <p className="text-sm text-slate-700">
                              {review.review}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <Card className="premium-shadow sticky top-24 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 p-0 backdrop-blur-sm">
              <div className="bg-linear-to-br from-turf-green/5 to-slate-50 p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-900">
                  Book a Session
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-5">
                  {/* Sport Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Select Sport
                    </label>
                    <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                      {coach.sports?.map((sport, index) => (
                        <button
                          key={`${sport}-${index}`}
                          onClick={() => setSelectedSport(sport)}
                          title={sport}
                          className={`rounded-lg border-2 px-3 py-2.5 text-left text-sm font-medium transition-all ${
                            selectedSport === sport
                              ? "bg-turf-green text-white border-turf-green shadow-md"
                              : "bg-white text-slate-700 border-slate-200 hover:border-turf-green"
                          }`}
                        >
                          <span className="block line-clamp-2 wrap-break-word">
                            {sport}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Select Date
                    </label>
                    <div className="relative">
                      <Calendar
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="date"
                        value={selectedDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-turf-green/50 focus:border-turf-green"
                      />
                    </div>
                  </div>

                  {/* Slots */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Available Slots
                    </label>
                    {availabilityLoading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-turf-green"></div>
                      </div>
                    ) : availability &&
                      availability.availableSlots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {availability.availableSlots.map((slot: string) => {
                          const startTime = slot.split("-")[0] || slot;
                          const startHour = parseInt(
                            startTime.split(":")[0] || "0",
                            10,
                          );
                          const endTime =
                            slot.split("-")[1] ||
                            `${String(startHour + 1).padStart(2, "0")}:00`;

                          const isSelected =
                            selectedSlot?.startTime === startTime;

                          return (
                            <button
                              key={slot}
                              onClick={() =>
                                setSelectedSlot({ startTime, endTime })
                              }
                              className={`px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all ${
                                isSelected
                                  ? "bg-turf-green text-white border-turf-green shadow-md"
                                  : "bg-white text-slate-700 border-slate-200 hover:border-turf-green"
                              }`}
                            >
                              {startTime} - {endTime}
                            </button>
                          );
                        })}
                      </div>
                    ) : availability ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        No slots available for this date.
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">
                        Select a date to view slots
                      </p>
                    )}
                  </div>

                  {/* Price Display */}
                  <div className="pt-5 border-t-2 border-slate-100">
                    <div className="bg-turf-green/5 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">
                          {selectedSport || "Selected Sport"} Rate
                        </span>
                        <span className="text-2xl font-bold text-turf-green flex items-center">
                          <IndianRupee size={20} />
                          {selectedSportRate}
                        </span>
                      </div>
                    </div>

                    {user ? (
                      <Button
                        variant="primary"
                        className="w-full h-12 text-base font-semibold bg-turf-green hover:bg-green-700 shadow-md"
                        onClick={handleBooking}
                        disabled={bookingLoading || !selectedSlot}
                      >
                        {bookingLoading ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Check size={20} className="mr-2" />
                        )}
                        Confirm Booking
                      </Button>
                    ) : (
                      <Link href={`/login?redirect=/coaches/${coachId}`}>
                        <Button
                          variant="secondary"
                          className="w-full h-12 font-semibold"
                        >
                          <User size={20} className="mr-2" />
                          Sign In to Book
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
