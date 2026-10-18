"use client";

import { getCommunityAppUrl } from "@/lib/community/url";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import { CommunityInsightsCard } from "@/modules/community/components/CommunityInsightsCard";
import ParentExperiencesBand from "@/modules/community/components/ParentExperiencesBand";
import { buildCoachCommunityIntent } from "@/modules/community/utils/coachCommunityIntent";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { reviewApi } from "@/modules/review/services/review";
import { SlotGrid } from "@/modules/booking/components/SlotGrid";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { Availability, Coach, ReviewItem, ReviewSummary } from "@/types";
import { getOwnVenueLocationDisplay } from "@/utils/location";
import { ArrowLeft, Award, Check, ImageIcon, Star } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

const formatInr = (value?: number) => {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value / 100);
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
    new Set(sources.map((s) => normalizeImageUrl(s)).filter((s) => s.length > 0))
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => {
    setSourceIndex(0);
  }, [cleanedSources.join("|")]);
  const currentSource = cleanedSources[sourceIndex];
  if (!currentSource)
    return (
      <div className={iconClassName}>
        <ImageIcon size={24} />
      </div>
    );
  return (
    <img
      src={currentSource}
      alt={alt}
      className={className}
      onError={() => setSourceIndex((p) => p + 1)}
    />
  );
};

export function CoachDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const coachId = params.coachId as string;

  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
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
  const [eligibleBookingId, setEligibleBookingId] = useState<string | null>(null);
  const [reviewEligibilityReason, setReviewEligibilityReason] = useState("");
  const [subscriptionPackages, setSubscriptionPackages] = useState<any[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [subscribingPackageId, setSubscribingPackageId] = useState<string | null>(null);

  const slotsToDisplay =
    availability?.allSlots && availability.allSlots.length > 0
      ? availability.allSlots
      : availability?.availableSlots || [];

  const isSelectedSlotAvailable =
    (selectedSlot &&
      availability?.availableSlots?.some(
        (availSlot) => (availSlot.split("-")[0] || availSlot) === selectedSlot.startTime
      )) ??
    false;

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
    if (!coach) return 0;
    const sportRate = coach.sportPricing?.[sport];
    if (typeof sportRate === "number" && sportRate > 0) return sportRate;
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
    ].filter((v): v is string => typeof v === "string");
  };

  const getVenueImages = (coachData: Coach) => {
    return (coachData.ownVenueDetails?.images || [])
      .map((v) => normalizeImageUrl(v))
      .filter((v): v is string => v.length > 0);
  };

  const getVerificationBadge = (coachData: Coach) => {
    const status =
      coachData.verificationStatus || (coachData.isVerified ? "VERIFIED" : "UNVERIFIED");
    switch (status) {
      case "VERIFIED":
        return {
          label: "Verified",
          className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
        };
      case "PENDING":
        return {
          label: "Pending",
          className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
        };
      case "REVIEW":
        return {
          label: "In Review",
          className: "bg-indigo-100 text-indigo-700 border border-indigo-200",
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
      (v) => typeof v === "string" && v.trim().length > 0
    ).length;
  };

  const loadCoachDetails = useCallback(async () => {
    try {
      const response = await discoveryApi.getCoachById(coachId);
      if (response.success && response.data) {
        setCoach(response.data);
        if (response.data.sports && response.data.sports.length > 0)
          setSelectedSport(response.data.sports[0]);
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
        selectedSport || undefined
      );
      if (response.success && response.data) setAvailability(response.data);
      else setAvailability({ availableSlots: [], bookedSlots: [] });
    } catch {
      setAvailability({ availableSlots: [], bookedSlots: [] });
    } finally {
      setAvailabilityLoading(false);
    }
  }, [coachId, selectedDate, selectedSport]);

  const loadSubscriptionPackages = useCallback(async () => {
    setPackagesLoading(true);
    try {
      const response = await coachApi.getCoachPackages(coachId);
      if (response.success && response.data) setSubscriptionPackages(response.data.packages || []);
      else setSubscriptionPackages([]);
    } catch {
      setSubscriptionPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    if (coachId) loadCoachDetails();
  }, [coachId, loadCoachDetails]);
  useEffect(() => {
    if (coachId && selectedDate) loadAvailability();
  }, [coachId, selectedDate, selectedSport, loadAvailability]);
  useEffect(() => {
    setSelectedSlot(null);
  }, [selectedSport, selectedDate]);
  useEffect(() => {
    if (coachId) loadReviews();
  }, [coachId]);
  useEffect(() => {
    if (coachId && user?.id) loadReviewEligibility();
    else {
      setEligibleBookingId(null);
      setReviewEligibilityReason("");
    }
  }, [coachId, user?.id, reviews.length]);
  useEffect(() => {
    if (coachId) void loadSubscriptionPackages();
  }, [coachId, loadSubscriptionPackages]);

  const loadReviews = async () => {
    setReviewLoading(true);
    try {
      const response = await reviewApi.getCoachReviews(coachId, 1, 20);
      if (response.success && response.data) {
        setReviews(response.data.reviews || []);
        setReviewSummary(response.data.summary || { averageRating: 0, reviewCount: 0 });
      }
    } catch {
      /* silent */
    } finally {
      setReviewLoading(false);
    }
  };

  const loadReviewEligibility = async () => {
    try {
      const response = await reviewApi.getReviewEligibility({
        targetType: "Coach",
        targetId: coachId,
      });
      if (response.success && response.data) {
        setEligibleBookingId(response.data.eligible ? response.data.bookingId : null);
        setReviewEligibilityReason(response.data.reason || "");
      }
    } catch {
      setEligibleBookingId(null);
      setReviewEligibilityReason("Unable to verify review eligibility right now");
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
        targetType: "Coach",
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
      toast.error(error?.response?.data?.message || error?.message || "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleSubscribeToPackage = async (packageId: string) => {
    if (!user) {
      router.push(`/login?redirect=/coaches/${coachId}`);
      return;
    }
    if (user.role !== "Player" && user.role !== "Parent") {
      toast.error("Only player accounts can subscribe to packages");
      return;
    }
    const p = new URLSearchParams({ coachId, packageId });
    router.push(`/dashboard/subscription-checkout?${p.toString()}`);
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
      const p = new URLSearchParams({
        type: "coach",
        coachId,
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        sport: selectedSport,
      });
      router.push(`/checkout?${p.toString()}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!user) {
      router.push(`/login?redirect=/coaches/${coachId}`);
      return;
    }
    if (user.role !== "Player" && user.role !== "Parent") {
      toast.error("Only player accounts can join waitlists.");
      return;
    }
    if (!selectedSlot || !selectedSport) {
      toast.error("Please select a sport and time slot");
      return;
    }
    setBookingLoading(true);
    try {
      await bookingApi.joinWaitlist({
        coachId,
        sport: selectedSport,
        date: new Date(selectedDate).toISOString(),
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
      toast.success("Added to the waitlist. You'll be notified if a spot opens.");
      setSelectedSlot(null);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to join waitlist. Please try again."
      );
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-paper min-h-screen" aria-busy="true" aria-label="Loading coach">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-10 h-5 w-28" />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
            <div>
              <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
                <Skeleton className="aspect-[4/5] w-36 rounded-2xl sm:w-44" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-12 w-64" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
              <Skeleton className="mt-10 h-20 w-full" />
              <Skeleton className="mt-8 h-40 w-full" />
            </div>
            <Skeleton className="h-[28rem] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <h1 className="font-editorial mb-4 text-2xl font-normal">Coach not found</h1>
        <Link href="/booking?tab=coaches">
          <Button variant="outline">Back to Coaches</Button>
        </Link>
      </div>
    );
  }

  const selectedSportRate = getSportRate(selectedSport || coach.sports?.[0]);
  const coachImageCandidates = getCoachImageCandidates(coach);
  const venueImages = getVenueImages(coach);
  const coachUserName =
    typeof coach.userId === "object" && coach.userId?.name ? coach.userId.name : "";
  const coachDisplayName = coachUserName || `${coach.sports?.[0] || "Professional"} Coach`;
  const highlightedSports = coach.sports.slice(0, 6);
  const additionalSportsCount = Math.max(coach.sports.length - 6, 0);

  const facts = [
    {
      label: "Format",
      value: String(coach.serviceMode || "")
        .replace(/_/g, " ")
        .toLowerCase(),
    },
    { label: "Rate", value: `₹${selectedSportRate} per hour` },
    {
      label: "Reviews",
      value: `${coach.reviewCount} ${coach.reviewCount === 1 ? "review" : "reviews"}`,
    },
  ].filter((f) => f.value.trim().length > 0);

  const badge = getVerificationBadge(coach);
  const certificationCount = getCertificationCount(coach);

  const sectionHeading = "font-editorial text-ink mb-4 text-2xl font-normal sm:text-3xl";
  const fieldLabel = "text-ink mb-2.5 block text-sm font-medium";
  const choice = (active: boolean) =>
    `focus-visible:ring-ink rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${
      active
        ? "border-ink bg-paper-deep text-ink"
        : "border-hairline text-ink-body hover:border-ink/40 bg-white"
    }`;

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <nav aria-label="Coach pages" className="mb-10 text-sm">
          <Link
            href="/booking?tab=coaches"
            className="text-ink-body hover:text-ink focus-visible:ring-ink group inline-flex items-center gap-1.5 rounded font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
          >
            <ArrowLeft
              aria-hidden
              strokeWidth={1.5}
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
            />
            All coaches
          </Link>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-16">
          {/* Profile */}
          <div className="min-w-0">
            <header className="flex flex-col gap-8 sm:flex-row sm:items-end">
              <div className="bg-paper-deep aspect-[4/5] w-36 shrink-0 overflow-hidden rounded-2xl sm:w-44">
                <CoachImageWithFallback
                  sources={coachImageCandidates}
                  alt={`${coachDisplayName}`}
                  className="h-full w-full object-cover"
                  iconClassName="text-ink-muted flex h-full w-full items-center justify-center"
                />
              </div>
              <div className="min-w-0">
                <p className="text-ink-muted mb-3 flex items-center gap-1.5 text-sm font-medium">
                  <Check aria-hidden strokeWidth={2} className="text-ink h-4 w-4" />
                  {badge.label} coach
                </p>
                <h1 className="font-editorial text-ink wrap-break-word text-balance text-4xl font-light leading-[1.05] sm:text-5xl lg:text-6xl">
                  {coachDisplayName}
                </h1>
                <p className="text-ink-body mt-4 flex items-center gap-2 text-sm">
                  {coach.reviewCount > 0 ? (
                    <>
                      <Star
                        aria-hidden
                        strokeWidth={1.5}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                      <span className="text-ink font-semibold tabular-nums">
                        {coach.rating.toFixed(1)}
                      </span>
                      <span className="text-ink-muted">({coach.reviewCount} reviews)</span>
                    </>
                  ) : (
                    <span className="text-ink-muted">No reviews yet</span>
                  )}
                </p>
                <Button asChild size="md" className="mt-6 lg:hidden">
                  <a href="#book">Book a session · ₹{selectedSportRate}/hr</a>
                </Button>
              </div>
            </header>

            <dl className="border-hairline mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-y py-6 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-ink-muted text-sm">{f.label}</dt>
                  <dd className="text-ink mt-1 text-pretty font-medium capitalize">{f.value}</dd>
                </div>
              ))}
            </dl>

            {coach.sports.length > 0 && (
              <dl className="mt-6 grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-6">
                <dt className="text-ink-muted text-sm">Sports</dt>
                <dd className="text-ink text-pretty">
                  {highlightedSports.join(", ")}
                  {additionalSportsCount > 0 ? ` and ${additionalSportsCount} more` : ""}
                </dd>
              </dl>
            )}

            <section className="mt-16" aria-labelledby="about-heading">
              <h2 id="about-heading" className={sectionHeading}>
                About
              </h2>
              <p className="text-ink-body max-w-[65ch] text-base leading-relaxed sm:text-lg">
                {coach.bio ||
                  "Expert coach offering professional training sessions to help you improve your skills."}
              </p>
            </section>

            <div className="mt-14">
              <CommunityInsightsCard
                title="Ask players about this coach"
                description="Check community recommendations on coaching style, progression quality, and best-fit sessions."
                q={communityIntent.q}
                sport={communityIntent.sport}
                ctaUrl={communityUrl}
                ctaTracking={{
                  eventName: "community_cta_click",
                  entityType: "Coach",
                  entityId: coachId,
                  metadata: {
                    ...communityIntent.analyticsMetadata,
                    page: "coach_detail",
                  },
                }}
                enabled={Boolean(user && (user.role === "Player" || user.role === "Coach"))}
              />
            </div>

            {/* Subscription packages */}
            <section className="mt-14" aria-labelledby="packages-heading">
              <h2 id="packages-heading" className={sectionHeading}>
                Subscription packages
              </h2>
              <p className="text-ink-body mb-6 max-w-[60ch] text-pretty">
                Monthly, quarterly and yearly packages published by this coach.
              </p>
              {packagesLoading ? (
                <p className="text-ink-muted text-sm">Loading packages…</p>
              ) : subscriptionPackages.length === 0 ? (
                <p className="text-ink-body max-w-[52ch] text-pretty">
                  This coach has not published any subscription packages yet.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {subscriptionPackages.map((pkg) => {
                    const packageId = String(pkg?._id || pkg?.id || "");
                    const isBusy = subscribingPackageId === packageId;
                    const frequencyLabel =
                      pkg?.frequency === "YEARLY"
                        ? "year"
                        : pkg?.frequency === "QUARTERLY"
                          ? "quarter"
                          : "month";
                    return (
                      <li
                        key={packageId || pkg?.name || "package"}
                        className="border-hairline flex h-full flex-col rounded-2xl border bg-white p-6"
                      >
                        <p className="text-ink font-semibold">
                          {pkg?.name || "Subscription package"}
                        </p>
                        <p className="mt-2 flex items-baseline gap-2">
                          <span className="font-editorial text-ink text-4xl font-light tabular-nums">
                            {formatInr(pkg?.price)}
                          </span>
                          <span className="text-ink-muted text-sm">per {frequencyLabel}</span>
                        </p>
                        {pkg?.description && (
                          <p className="text-ink-body mt-3 text-sm leading-relaxed">
                            {pkg.description}
                          </p>
                        )}
                        <div className="mt-4">
                          {(pkg?.features || []).length > 0 ? (
                            <ul className="text-ink-body space-y-1.5 text-sm">
                              {pkg.features.map((feature: string, index: number) => (
                                <li key={`${feature}-${index}`} className="flex gap-2">
                                  <Check
                                    aria-hidden
                                    strokeWidth={2}
                                    className="text-ink mt-0.5 h-4 w-4 shrink-0"
                                  />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-ink-muted text-sm">
                              Coach has not listed package features yet.
                            </p>
                          )}
                        </div>
                        <p className="text-ink-muted mt-4 text-sm">
                          {typeof pkg?.maxStudents === "number"
                            ? `Up to ${pkg.maxStudents} students`
                            : "Student limit flexible"}
                          {" · "}
                          {typeof pkg?.maxSessions === "number"
                            ? `${pkg.maxSessions} sessions`
                            : "Session limit flexible"}
                        </p>
                        <div className="mt-auto pt-5">
                          {user ? (
                            user.role === "Player" ? (
                              <Button
                                variant="primary"
                                className="w-full"
                                onClick={() => handleSubscribeToPackage(packageId)}
                                disabled={!packageId || isBusy}
                              >
                                {isBusy ? "Activating…" : "Subscribe now"}
                              </Button>
                            ) : (
                              <p className="text-ink-muted text-sm">
                                Subscription packages are available for player accounts.
                              </p>
                            )
                          ) : (
                            <Link href={`/login?redirect=/coaches/${coachId}`}>
                              <Button variant="outline" className="w-full">
                                Sign in to subscribe
                              </Button>
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Venue photos */}
            {venueImages.length > 0 && (
              <section className="mt-14" aria-labelledby="venue-images-heading">
                <h2 id="venue-images-heading" className={sectionHeading}>
                  Venue photos
                </h2>
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {venueImages.map((imageUrl, index) => (
                    <li
                      key={`${imageUrl}-${index}`}
                      className="bg-paper-deep overflow-hidden rounded-2xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={`Venue photo ${index + 1}`}
                        loading="lazy"
                        className="h-48 w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {coach.serviceMode === "OWN_VENUE" && coach.ownVenueDetails && (
              <section className="mt-14" aria-labelledby="venue-location-heading">
                <h2 id="venue-location-heading" className={sectionHeading}>
                  Venue location
                </h2>
                {(() => {
                  const venueLocation = getOwnVenueLocationDisplay(coach.ownVenueDetails);
                  if (!venueLocation) return null;
                  return (
                    <div className="text-ink-body max-w-[65ch] space-y-3 text-base">
                      <div>
                        <p className="text-ink font-semibold">{venueLocation.title}</p>
                        <p>{venueLocation.description}</p>
                      </div>
                      {venueLocation.mapsUrl && (
                        <a
                          href={venueLocation.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink decoration-ink/30 hover:decoration-ink inline-flex text-sm font-medium underline underline-offset-4"
                        >
                          Open in Maps
                        </a>
                      )}
                      {coach.ownVenueDetails.description && (
                        <p className="text-ink-body">{coach.ownVenueDetails.description}</p>
                      )}
                    </div>
                  );
                })()}
              </section>
            )}

            {/* Verification */}
            <section className="mt-14" aria-labelledby="verification-heading">
              <h2 id="verification-heading" className={sectionHeading}>
                Verification
              </h2>
              <div className="text-ink-body max-w-[65ch] space-y-3">
                <p className="flex items-center gap-2 text-base">
                  <Award aria-hidden strokeWidth={1.5} className="text-ink h-5 w-5" />
                  <span className="text-ink font-medium">{badge.label}</span>
                  <span className="text-ink-muted">
                    {certificationCount > 0
                      ? `${certificationCount} credential${certificationCount !== 1 ? "s" : ""} on file`
                      : "No public credential details"}
                  </span>
                </p>
                <p className="text-sm leading-relaxed">
                  For privacy and security, individual certificate files are not shown on public
                  profiles. This section shows the platform&apos;s review status only; credential
                  documents are kept for internal checks and are never exposed publicly.
                </p>
              </div>
            </section>

            {/* Reviews */}
            <section className="mt-14" aria-labelledby="reviews-heading">
              <h2 id="reviews-heading" className={sectionHeading}>
                Reviews
              </h2>
              {reviewSummary.reviewCount > 0 && (
                <p className="mb-6 flex items-baseline gap-3">
                  <span className="font-editorial text-ink text-5xl font-light tabular-nums">
                    {reviewSummary.averageRating.toFixed(1)}
                  </span>
                  <span className="text-ink-muted text-sm">
                    from {reviewSummary.reviewCount}{" "}
                    {reviewSummary.reviewCount === 1 ? "review" : "reviews"}
                  </span>
                </p>
              )}

              {user && eligibleBookingId && (
                <div className="border-hairline mb-8 rounded-2xl border bg-white p-5">
                  <p className="text-ink mb-3 text-sm font-medium">Share your experience</p>
                  <div className="mb-3 flex items-center gap-1" role="group" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`${star} star${star === 1 ? "" : "s"}`}
                        aria-pressed={star <= reviewRating}
                        onClick={() => setReviewRating(star)}
                        className="focus-visible:ring-ink rounded p-0.5 focus-visible:outline-none focus-visible:ring-2"
                      >
                        <Star
                          aria-hidden
                          strokeWidth={1.5}
                          className={`h-6 w-6 ${star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    aria-label="Your review"
                    placeholder="Write your review (optional)"
                    className="border-hairline text-ink placeholder:text-ink-muted focus-visible:ring-ink w-full resize-none rounded-lg border bg-white px-3.5 py-3 text-sm focus-visible:outline-none focus-visible:ring-2"
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="primary"
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting || reviewRating === 0}
                    >
                      {reviewSubmitting ? "Submitting…" : "Submit review"}
                    </Button>
                  </div>
                </div>
              )}
              {user && !eligibleBookingId && (
                <p className="text-ink-muted mb-6 text-sm">
                  {reviewEligibilityReason || "Complete a session with this coach to add a review."}
                </p>
              )}

              {reviewLoading ? (
                <p className="text-ink-muted text-sm">Loading reviews…</p>
              ) : reviews.length === 0 ? (
                <p className="text-ink-body max-w-[52ch] text-pretty">
                  No reviews yet. Be the first to review this coach.
                </p>
              ) : (
                <ul className="border-hairline border-t">
                  {reviews.map((review) => {
                    const reviewer =
                      typeof review.userId === "object" && review.userId !== null
                        ? review.userId
                        : null;
                    return (
                      <li
                        key={String(review._id || review.id)}
                        className="border-hairline border-b py-6"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="text-ink font-semibold">{reviewer?.name || "A parent"}</p>
                          <span
                            className="flex items-center gap-0.5"
                            role="img"
                            aria-label={`${review.rating} out of 5`}
                          >
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Star
                                key={index}
                                aria-hidden
                                strokeWidth={1.5}
                                className={`h-3.5 w-3.5 ${index < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                              />
                            ))}
                          </span>
                        </div>
                        {review.review && (
                          <p className="text-ink-body mt-2 max-w-[65ch] text-pretty leading-relaxed">
                            {review.review}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="mt-16">
              <ParentExperiencesBand kind="COACH" refId={coachId} name={coachDisplayName} />
            </div>
          </div>

          {/* Booking */}
          <aside
            id="book"
            aria-label="Book a session"
            className="min-w-0 scroll-mt-24 lg:top-24 lg:[@media(min-height:860px)]:sticky"
          >
            <div className="border-hairline overflow-hidden rounded-2xl border bg-white">
              <div className="border-hairline border-b p-6 sm:p-8">
                <p className="text-ink-muted text-sm">{selectedSport || "Session"} rate</p>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="font-editorial text-ink text-5xl font-light tabular-nums">
                    ₹{selectedSportRate}
                  </span>
                  <span className="text-ink-muted text-sm">per hour</span>
                </p>
              </div>

              <div className="space-y-7 p-6 sm:p-8">
                <div role="group" aria-labelledby="sport-label">
                  <span id="sport-label" className={fieldLabel}>
                    Sport
                  </span>
                  <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
                    {coach.sports?.map((sport, index) => (
                      <button
                        key={`${sport}-${index}`}
                        type="button"
                        aria-pressed={selectedSport === sport}
                        onClick={() => setSelectedSport(sport)}
                        title={sport}
                        className={choice(selectedSport === sport)}
                      >
                        <span className="wrap-break-word line-clamp-2 block">{sport}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="coach-date" className={fieldLabel}>
                    Date
                  </label>
                  <input
                    id="coach-date"
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border-hairline text-ink focus-visible:ring-ink w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2"
                  />
                </div>

                <div role="group" aria-labelledby="slot-label">
                  <span id="slot-label" className={fieldLabel}>
                    Time
                  </span>
                  {availabilityLoading ? (
                    <div className="grid grid-cols-2 gap-2" aria-busy="true">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="bg-paper-deep h-11 animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : availability && slotsToDisplay.length > 0 ? (
                    <SlotGrid
                      slots={slotsToDisplay}
                      availableSlots={availability?.availableSlots ?? []}
                      selectedStart={selectedSlot?.startTime ?? null}
                      onSelect={setSelectedSlot}
                    />
                  ) : availability ? (
                    <p className="text-ink-muted py-2 text-sm">No slots available for this date.</p>
                  ) : (
                    <p className="text-ink-muted py-2 text-sm">Select a date to view slots.</p>
                  )}
                </div>

                <div className="border-hairline border-t pt-6">
                  {selectedSlot && (
                    <dl className="text-ink-body mb-5 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt>Time</dt>
                        <dd className="text-ink font-medium tabular-nums">
                          {selectedSlot.startTime} – {selectedSlot.endTime}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Status</dt>
                        <dd className="text-ink font-medium">
                          {isSelectedSlotAvailable ? "Available" : "Booked, join the waitlist"}
                        </dd>
                      </div>
                    </dl>
                  )}

                  {user ? (
                    !selectedSlot ? (
                      <Button variant="primary" size="lg" className="w-full" disabled>
                        Select a time to continue
                      </Button>
                    ) : isSelectedSlotAvailable ? (
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full"
                        onClick={handleBooking}
                        disabled={bookingLoading || !selectedSlot}
                        loading={bookingLoading}
                      >
                        Confirm booking
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        onClick={handleJoinWaitlist}
                        disabled={bookingLoading || !selectedSlot}
                        loading={bookingLoading}
                      >
                        Join waitlist
                      </Button>
                    )
                  ) : (
                    <Link href={`/login?redirect=/coaches/${coachId}`}>
                      <Button variant="outline" size="lg" className="w-full">
                        Sign in to book
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
