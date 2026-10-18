"use client";

import { getCommunityAppUrl } from "@/lib/community/url";
import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { CommunityInsightsCard } from "@/modules/community/components/CommunityInsightsCard";
import ParentExperiencesBand from "@/modules/community/components/ParentExperiencesBand";
import { discoveryApi } from "@/modules/discovery/services/discovery";
import { reviewApi } from "@/modules/review/services/review";
import { SlotGrid } from "@/modules/booking/components/SlotGrid";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { Availability, ReviewItem, ReviewSummary, Venue } from "@/types";
import { getVenueImageUrls, getVenueSportImageUrls } from "@/utils/venueImages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function VenueDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const venueId = params.venueId as string;
  const queryClient = useQueryClient();

  // Primary venue fetch, via React Query instead of a bespoke
  // useEffect+useState pair. Two things fall out of that:
  // - page.tsx (the server component above this one) prefetches this exact
  //   query key and hands the cache over already hydrated, so a fresh
  //   navigation here can skip the loading spinner entirely instead of
  //   fetching from scratch on the client;
  // - handleSubmitReview below now invalidates this query key instead of
  //   calling a manual reload function.
  const {
    data: venue = null,
    isLoading: loading,
    isError: venueLoadFailed,
  } = useQuery({
    queryKey: queryKeys.discovery.venue(venueId),
    queryFn: async () => {
      const response = await discoveryApi.getVenueById(venueId);
      return response.success ? ((response.data as Venue) ?? null) : null;
    },
    enabled: Boolean(venueId),
  });
  // Use local date (not UTC) so midnight-to-dawn visitors see today's date,
  // not yesterday's (which toISOString() would return for IST before 05:30 UTC).
  const getLocalDateString = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const venueImages = venue ? getVenueImageUrls(venue) : [];
  const selectedSportImages = venue ? getVenueSportImageUrls(venue, selectedSport) : [];
  const sportPhotoCount = selectedSportImages.length;
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
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

  const slotsToDisplay = (() => {
    const raw =
      availability?.allSlots && availability.allSlots.length > 0
        ? availability.allSlots
        : availability?.availableSlots || [];

    // When the selected date is today, hide slots whose start time is already past.
    const localDateStr = getLocalDateString();
    if (selectedDate !== localDateStr) return raw;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return raw.filter((slot: string) => {
      const startTime = slot.split("-")[0] || slot; // "HH:MM"
      const [h = "0", m = "0"] = startTime.split(":");
      const slotMinutes = parseInt(h) * 60 + parseInt(m);
      return slotMinutes > currentMinutes;
    });
  })();

  const isSelectedSlotAvailable =
    (selectedSlot &&
      availability?.availableSlots?.some(
        (availSlot) => (availSlot.split("-")[0] || availSlot) === selectedSlot.startTime
      )) ??
    false;

  const communityUrl = getCommunityAppUrl({
    path: "q",
    searchParams: {
      q: `${selectedSport || venue?.sports?.[0] || ""} ${venue?.name || ""}`.trim() || undefined,
      sport: selectedSport || venue?.sports?.[0] || undefined,
    },
  });

  const selectedSportPhotoCountLabel = (sport: string, count: number): string => {
    if (!sport || count <= 0) return "";
    return `${sport}: ${count} photos`;
  };

  // Re-derive the default selected sport whenever the venue query resolves
  // (first load, or the refetch triggered from handleSubmitReview) — same
  // behavior the old loadVenueDetails() had, just keyed off the query's data
  // instead of an imperative call.
  useEffect(() => {
    if (venue?.sports && venue.sports.length > 0) {
      setSelectedSport(venue.sports[0]);
    }
  }, [venue]);

  useEffect(() => {
    if (venueLoadFailed) {
      toast.error("Failed to load venue details");
    }
  }, [venueLoadFailed]);

  useEffect(() => {
    if (venueId && selectedDate) loadAvailability();
  }, [venueId, selectedDate]);

  useEffect(() => {
    if (venueId) loadReviews();
  }, [venueId]);

  useEffect(() => {
    if (venueId && user?.id) {
      loadReviewEligibility();
    } else {
      setEligibleBookingId(null);
      setReviewEligibilityReason("");
    }
  }, [venueId, user?.id]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [venue?.id, venue?._id]);

  const openLightbox = (index: number) => {
    setSelectedImageIndex(index);
    setLightboxOpen(true);
  };

  const showPreviousImage = () => {
    if (venueImages.length <= 1) return;
    setSelectedImageIndex((prev) => (prev === 0 ? venueImages.length - 1 : prev - 1));
  };

  const showNextImage = () => {
    if (venueImages.length <= 1) return;
    setSelectedImageIndex((prev) => (prev === venueImages.length - 1 ? 0 : prev + 1));
  };

  const handleLightboxTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0]?.clientX ?? null);
  };

  const handleLightboxTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchEndX(e.targetTouches[0]?.clientX ?? null);
  };

  const handleLightboxTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const swipeDistance = touchStartX - touchEndX;
    const threshold = 50;
    if (swipeDistance > threshold) showNextImage();
    else if (swipeDistance < -threshold) showPreviousImage();
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxOpen(false);
        return;
      }
      if (event.key === "ArrowLeft") showPreviousImage();
      if (event.key === "ArrowRight") showNextImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, venueImages.length]);

  const loadAvailability = async () => {
    try {
      const response = await bookingApi.getVenueAvailability(venueId, selectedDate);
      if (response.success && response.data) setAvailability(response.data);
    } catch (error) {
      console.error("Failed to load availability:", error);
    }
  };

  const loadReviews = async () => {
    setReviewLoading(true);
    try {
      const response = await reviewApi.getVenueReviews(venueId, 1, 20);
      if (response.success && response.data) {
        setReviews(response.data.reviews || []);
        setReviewSummary(response.data.summary || { averageRating: 0, reviewCount: 0 });
      }
    } catch (error) {
      console.error("Failed to load venue reviews:", error);
    } finally {
      setReviewLoading(false);
    }
  };

  const loadReviewEligibility = async () => {
    try {
      const response = await reviewApi.getReviewEligibility({
        targetType: "VENUE",
        targetId: venueId,
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
      router.push(`/login?redirect=/venues/${venueId}`);
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
        targetType: "VENUE",
        targetId: venueId,
        rating: reviewRating,
        ...(reviewText.trim() ? { review: reviewText.trim() } : {}),
      });
      if (response.success) {
        toast.success("Review submitted successfully");
        setReviewRating(0);
        setReviewText("");
        setEligibleBookingId(null);
        await Promise.all([
          loadReviews(),
          queryClient.invalidateQueries({
            queryKey: queryKeys.discovery.venue(venueId),
          }),
        ]);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleBooking = async () => {
    if (!user) {
      router.push("/login?redirect=/venues/" + venueId);
      return;
    }
    if (user.role !== "Player" && user.role !== "Parent") {
      toast.error("Only player accounts can create bookings.");
      return;
    }
    if (!selectedSlot || !selectedSport) {
      toast.error("Please select a sport and time slot");
      return;
    }
    setBookingLoading(true);
    try {
      const checkoutParams = new URLSearchParams({
        date: selectedDate,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        sport: selectedSport,
      });
      router.push(`/checkout?type=venue&venueId=${venueId}&${checkoutParams.toString()}`);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!user) {
      router.push(`/login?redirect=/venues/${venueId}`);
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
        venueId,
        sport: selectedSport,
        date: new Date(selectedDate).toISOString(),
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
      });
      toast.success("Added to the waitlist. We'll notify you when a slot opens.");
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
      <div className="bg-paper min-h-screen" aria-busy="true" aria-label="Loading venue">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-10 h-5 w-28" />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-4 h-14 w-80 max-w-full" />
              <Skeleton className="mt-4 h-4 w-64" />
              <Skeleton className="mt-12 aspect-[16/10] w-full rounded-2xl" />
              <Skeleton className="mt-10 h-32 w-full" />
            </div>
            <Skeleton className="h-[28rem] w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="bg-paper flex min-h-screen flex-col items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="font-editorial text-2xl font-normal text-slate-900">Venue not found</h1>
          <p className="text-slate-600">
            The venue you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/booking?tab=venues">
            <Button variant="primary">Browse All Venues</Button>
          </Link>
        </div>
      </div>
    );
  }

  const pricePerHour = venue.sportPricing?.[selectedSport] || venue.pricePerHour;

  const sectionHeading = "font-editorial text-ink mb-4 text-2xl font-normal sm:text-3xl";
  const fieldLabel = "text-ink mb-2.5 block text-sm font-medium";
  const choice = (active: boolean) =>
    `focus-visible:ring-ink rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${
      active
        ? "border-ink bg-paper-deep text-ink"
        : "border-hairline text-ink-body hover:border-ink/40 bg-white"
    }`;
  const roundButton =
    "focus-visible:ring-paper absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink transition-colors duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-2";

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <nav aria-label="Venue pages" className="mb-10 text-sm">
          <Link
            href="/booking?tab=venues"
            className="text-ink-body hover:text-ink focus-visible:ring-ink group inline-flex items-center gap-1.5 rounded font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
          >
            <ArrowLeft
              aria-hidden
              strokeWidth={1.5}
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
            />
            All venues
          </Link>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-16">
          {/* Venue */}
          <div className="min-w-0">
            <header>
              <p className="text-ink-muted mb-3 flex items-center gap-1.5 text-sm font-medium">
                <Check aria-hidden strokeWidth={2} className="text-ink h-4 w-4" />
                Verified venue
              </p>
              <h1 className="font-editorial text-ink wrap-break-word text-balance text-4xl font-light leading-[1.05] sm:text-5xl lg:text-6xl">
                {venue.name}
              </h1>
              {venue.address && (
                <p className="text-ink-body mt-4 max-w-[60ch] text-pretty text-base sm:text-lg">
                  {venue.address}
                </p>
              )}
              <p className="text-ink-body mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-2">
                  <Star
                    aria-hidden
                    strokeWidth={1.5}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                  <span className="text-ink font-semibold tabular-nums">
                    {venue.rating?.toFixed(1) || "5.0"}
                  </span>
                  <span className="text-ink-muted">({venue.reviewCount || 0} reviews)</span>
                </span>
                <span className="text-ink">
                  <span className="font-semibold tabular-nums">₹{venue.pricePerHour}</span>
                  <span className="text-ink-muted"> per hour from</span>
                </span>
              </p>
              <Button asChild size="md" className="mt-6 lg:hidden">
                <a href="#book">Book a slot · ₹{pricePerHour}/hr</a>
              </Button>
            </header>

            {/* Gallery */}
            {venueImages.length > 0 && (
              <section className="mt-12" aria-label="Venue photos">
                <div
                  className="bg-paper-deep group relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-2xl sm:aspect-[16/10]"
                  onClick={() => openLightbox(selectedImageIndex)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={venueImages[selectedImageIndex]}
                    alt={`${venue.name}, photo ${selectedImageIndex + 1} of ${venueImages.length}`}
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                  />
                  <p className="bg-paper/90 text-ink absolute bottom-3 left-3 rounded-md px-2.5 py-1 text-xs font-medium tabular-nums">
                    {selectedImageIndex + 1} of {venueImages.length}
                    {sportPhotoCount > 0
                      ? ` · ${selectedSportPhotoCountLabel(selectedSport, sportPhotoCount)}`
                      : ""}
                  </p>
                  {venueImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          showPreviousImage();
                        }}
                        className={`${roundButton} left-3`}
                        aria-label="Previous photo"
                      >
                        <ChevronLeft aria-hidden strokeWidth={1.5} size={20} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          showNextImage();
                        }}
                        className={`${roundButton} right-3`}
                        aria-label="Next photo"
                      >
                        <ChevronRight aria-hidden strokeWidth={1.5} size={20} />
                      </button>
                    </>
                  )}
                </div>

                {venueImages.length > 1 && (
                  <ul className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                    {venueImages.map((image, index) => (
                      <li key={`${image}-${index}`} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          aria-pressed={selectedImageIndex === index}
                          aria-label={`Show photo ${index + 1}`}
                          className={`focus-visible:ring-ink relative block h-16 w-24 overflow-hidden rounded-lg border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 ${
                            selectedImageIndex === index
                              ? "border-ink"
                              : "border-hairline hover:border-ink/40 opacity-80 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {lightboxOpen && venueImages.length > 0 && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Venue photos"
                className="bg-ink/90 fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={() => setLightboxOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="bg-paper/90 text-ink absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white"
                  aria-label="Close gallery"
                >
                  <X aria-hidden strokeWidth={1.5} size={20} />
                </button>
                {venueImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        showPreviousImage();
                      }}
                      className="bg-paper/90 text-ink absolute left-5 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft aria-hidden strokeWidth={1.5} size={22} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        showNextImage();
                      }}
                      className="bg-paper/90 text-ink absolute right-5 flex h-10 w-10 items-center justify-center rounded-full hover:bg-white"
                      aria-label="Next photo"
                    >
                      <ChevronRight aria-hidden strokeWidth={1.5} size={22} />
                    </button>
                  </>
                )}
                <div
                  className="max-h-[86vh] max-w-5xl overflow-hidden rounded-2xl"
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={handleLightboxTouchStart}
                  onTouchMove={handleLightboxTouchMove}
                  onTouchEnd={handleLightboxTouchEnd}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={venueImages[selectedImageIndex]}
                    alt={`${venue.name}, photo ${selectedImageIndex + 1}`}
                    className="max-h-[86vh] w-full object-contain"
                  />
                </div>
              </div>
            )}

            <section className="mt-16" aria-labelledby="about-heading">
              <h2 id="about-heading" className={sectionHeading}>
                About
              </h2>
              <p className="text-ink-body max-w-[65ch] text-base leading-relaxed sm:text-lg">
                {venue.description ||
                  "A venue for training and play, open for booking by the hour."}
              </p>
            </section>

            <div className="mt-14">
              <CommunityInsightsCard
                title="Ask the community about this venue"
                description="Get local feedback on crowd levels, coaching-friendly slots, and match quality before you lock your booking."
                q={`${selectedSport || venue?.sports?.[0] || ""} ${venue?.name || ""}`}
                sport={selectedSport || venue?.sports?.[0] || ""}
                ctaUrl={communityUrl}
                enabled={Boolean(user && (user.role === "Player" || user.role === "Coach"))}
              />
            </div>

            {/* Sports */}
            <section className="mt-14" aria-labelledby="sports-heading">
              <h2 id="sports-heading" className={sectionHeading}>
                Sports available
              </h2>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a sport">
                {venue.sports?.map((sport) => (
                  <button
                    type="button"
                    key={sport}
                    aria-pressed={selectedSport === sport}
                    onClick={() => setSelectedSport(sport)}
                    className={choice(selectedSport === sport)}
                  >
                    {sport}
                  </button>
                ))}
              </div>
            </section>

            {selectedSport && selectedSportImages.length > 0 && (
              <section className="mt-14" aria-labelledby="sport-photos-heading">
                <h2 id="sport-photos-heading" className={sectionHeading}>
                  {selectedSport} photos
                </h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {selectedSportImages.map((image, index) => {
                    const globalIndex = venueImages.findIndex((venueImage) => venueImage === image);
                    return (
                      <li key={`${selectedSport}-${index}-${image}`}>
                        <button
                          type="button"
                          onClick={() => openLightbox(globalIndex >= 0 ? globalIndex : 0)}
                          className="bg-paper-deep focus-visible:ring-ink group relative block aspect-[4/3] w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2"
                          aria-label={`Open ${selectedSport} photo ${index + 1}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt={`${venue.name}, ${selectedSport} photo ${index + 1}`}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Amenities */}
            {venue.amenities && venue.amenities.length > 0 && (
              <section className="mt-14" aria-labelledby="amenities-heading">
                <h2 id="amenities-heading" className={sectionHeading}>
                  Amenities
                </h2>
                <ul className="border-hairline grid grid-cols-1 gap-x-8 border-t sm:grid-cols-2">
                  {venue.amenities.map((amenity, index) => (
                    <li
                      key={index}
                      className="border-hairline text-ink flex items-center gap-3 border-b py-3.5"
                    >
                      <Check aria-hidden strokeWidth={2} className="text-ink h-4 w-4 shrink-0" />
                      <span>{amenity}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

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
                  {reviewEligibilityReason || "Complete a session at this venue to add a review."}
                </p>
              )}

              {reviewLoading ? (
                <p className="text-ink-muted text-sm">Loading reviews…</p>
              ) : reviews.length === 0 ? (
                <p className="text-ink-body max-w-[52ch] text-pretty">
                  No reviews yet. Be the first to review this venue.
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
              <ParentExperiencesBand kind="VENUE" refId={venueId} name={venue.name} />
            </div>
          </div>

          {/* Booking */}
          <aside
            id="book"
            aria-label="Book a slot"
            className="min-w-0 scroll-mt-24 lg:top-24 lg:[@media(min-height:860px)]:sticky"
          >
            <div className="border-hairline overflow-hidden rounded-2xl border bg-white">
              <div className="border-hairline border-b p-6 sm:p-8">
                <p className="text-ink-muted text-sm">{selectedSport || "Venue"} rate</p>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="font-editorial text-ink text-5xl font-light tabular-nums">
                    ₹{pricePerHour}
                  </span>
                  <span className="text-ink-muted text-sm">per hour</span>
                </p>
              </div>

              <div className="space-y-7 p-6 sm:p-8">
                <div role="group" aria-labelledby="sport-label">
                  <span id="sport-label" className={fieldLabel}>
                    Sport
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {venue.sports?.map((sport) => (
                      <button
                        key={sport}
                        type="button"
                        aria-pressed={selectedSport === sport}
                        onClick={() => setSelectedSport(sport)}
                        className={choice(selectedSport === sport)}
                      >
                        {sport}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="venue-date" className={fieldLabel}>
                    Date
                  </label>
                  <input
                    id="venue-date"
                    type="date"
                    value={selectedDate}
                    min={getLocalDateString()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border-hairline text-ink focus-visible:ring-ink w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2"
                  />
                </div>

                <div role="group" aria-labelledby="slot-label">
                  <span id="slot-label" className={fieldLabel}>
                    Time
                  </span>
                  {!availability ? (
                    <div className="grid grid-cols-2 gap-2" aria-busy="true">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="bg-paper-deep h-11 animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : slotsToDisplay.length > 0 ? (
                    <SlotGrid
                      slots={slotsToDisplay}
                      availableSlots={availability?.availableSlots ?? []}
                      selectedStart={selectedSlot?.startTime ?? null}
                      onSelect={setSelectedSlot}
                    />
                  ) : (
                    <p className="text-ink-muted py-2 text-sm">No slots available for this date.</p>
                  )}
                </div>

                <div className="border-hairline border-t pt-6">
                  {selectedSport && selectedSlot && (
                    <dl className="text-ink-body mb-5 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt>Sport</dt>
                        <dd className="text-ink font-medium">{selectedSport}</dd>
                      </div>
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
                      <div className="border-hairline flex items-baseline justify-between border-t pt-3">
                        <dt className="text-ink">Total</dt>
                        <dd className="font-editorial text-ink text-2xl font-light tabular-nums">
                          {isSelectedSlotAvailable ? `₹${pricePerHour}` : "Free to join"}
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
                        disabled={bookingLoading || !selectedSlot || !selectedSport}
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
                        disabled={bookingLoading || !selectedSlot || !selectedSport}
                        loading={bookingLoading}
                      >
                        Join waitlist
                      </Button>
                    )
                  ) : (
                    <Link href={`/login?redirect=/venues/${venueId}`}>
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
