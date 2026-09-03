import { getCommunityAppUrl } from "@/lib/community/url";
import { toast } from "@/lib/toast";
import { useFetchProfile } from "@/modules/auth/hooks/useProfile";
import { statsApi } from "@/modules/analytics/services/stats";
import { PaymentType } from "@/modules/booking/components/PaymentTypeSelector";
import { bookingApi } from "@/modules/booking/services/booking";
import { useBookingQuote } from "@/modules/booking/hooks/useBookingQuote";
import {
  AcademyCard,
  BookingType,
  getCoachDisplayName,
  PAYMENT_OPTIONS,
} from "@/modules/booking/utils/checkoutHelpers";
import { coachApi } from "@/modules/coach/services/coach";
import { consoleHomeFor } from "@/flow/policy";
import { CHECKOUT_FLOW } from "@/flow/flows/checkout";
import { useFlow } from "@/flow/useFlow";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { venueApi } from "@/modules/venue/services/venue";
import { walletApi } from "@/modules/wallet/services/wallet";
import { Coach, User, Venue } from "@/types";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";

/**
 * All state, effects and handlers for the checkout page — extracted so the
 * route file holds only routing and composition. `handleCheckout` in
 * particular is untouched character-for-character: it initiates real
 * payments, so this was a pure relocation, not a rewrite.
 */
export function useCheckoutFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const type = (searchParams.get("type") || "venue") as BookingType;
  const coachId = searchParams.get("coachId") || "";
  const venueId = searchParams.get("venueId") || "";
  const academyId = searchParams.get("academyId") || "";
  const academySlug = searchParams.get("academySlug") || "";
  const dependentId = searchParams.get("dependentId") || "";

  const [sport, setSport] = useState(searchParams.get("sport") || "");
  const [date, setDate] = useState(searchParams.get("date") || "");
  const [startTime, setStartTime] = useState(searchParams.get("startTime") || "");
  const [endTime, setEndTime] = useState(searchParams.get("endTime") || "");

  const [coach, setCoach] = useState<Coach | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [academy, setAcademy] = useState<AcademyCard | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedDependentId, setSelectedDependentId] = useState(dependentId);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("phonepe");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alternateSlots, setAlternateSlots] = useState<string[]>([]);
  const [showWaitlistPrompt, setShowWaitlistPrompt] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>("SINGLE");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    setSelectedDependentId(dependentId);
  }, [dependentId]);

  useEffect(() => {
    statsApi
      .trackFunnelEvent({
        eventName: "checkout_viewed",
        entityType: type.toUpperCase(),
        entityId: type === "coach" ? coachId : type === "academy" ? academyId : venueId,
        metadata: { sport, date, startTime, endTime },
        source: "WEB",
      })
      .catch(() => {});
  }, [type, coachId, venueId, academyId, sport, date, startTime, endTime]);

  // Shared cached profile fetch — same key as `useProfile`, so this page and
  // every other consumer collapse onto one cache entry instead of each issuing
  // its own request.
  const fetchProfile = useFetchProfile();

  useEffect(() => {
    const load = async () => {
      try {
        const entityFetch =
          type === "coach" && coachId
            ? coachApi.getCoachById(coachId)
            : type === "venue" && venueId
              ? venueApi.getVenue(venueId)
              : type === "academy" && (academySlug || academyId)
                ? academyOnboardingApi.getAcademyProfile(academySlug || academyId)
                : Promise.resolve(null);

        const [entityResp, profileResp, walletResp] = await Promise.all([
          entityFetch,
          fetchProfile().catch(() => null),
          walletApi.getWallet().catch(() => null),
        ]);

        if (type === "coach" && entityResp?.success) setCoach(entityResp.data as Coach);
        if (type === "venue" && entityResp?.success) setVenue(entityResp.data as Venue);
        if (type === "academy" && entityResp?.success) setAcademy(entityResp.data as AcademyCard);

        if (profileResp) {
          setUser(profileResp);
          if (profileResp.role !== "Player" && profileResp.role !== "Parent") {
            toast.error("Only player accounts can create bookings.");
            router.replace(consoleHomeFor(profileResp.role));
            return;
          }
        }

        if (walletResp) setWalletBalance(walletResp.balance);
      } catch {
        toast.error("Unable to load details");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, coachId, venueId, academyId, academySlug]);

  const durationMinutes = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm = "0"] = startTime.split(":");
    const [eh, em = "0"] = endTime.split(":");
    return Math.max(
      0,
      parseInt(eh, 10) * 60 + parseInt(em, 10) - parseInt(sh, 10) * 60 - parseInt(sm, 10)
    );
  }, [startTime, endTime]);

  const durationHours = useMemo(
    () => (durationMinutes ? Number((durationMinutes / 60).toFixed(2)) : 0),
    [durationMinutes]
  );

  const selectedDependent = user?.dependents?.find((d) => d._id === selectedDependentId) || null;

  const availableSports = useMemo(() => {
    if (type === "coach" && coach) return coach.sports || [];
    if (type === "venue" && venue) return venue.sports || [];
    if (type === "academy" && academy) return academy.sports || [];
    return [];
  }, [type, coach, venue, academy]);

  const pricePerHour = useMemo(() => {
    if (type === "coach" && coach)
      return sport && coach.sportPricing?.[sport]
        ? coach.sportPricing[sport]
        : coach.hourlyRate || 0;
    if (type === "venue" && venue)
      return sport && venue.sportPricing?.[sport]
        ? venue.sportPricing[sport]
        : venue.pricePerHour || 0;
    if (type === "academy" && academy)
      return typeof academy.sessionRatePerHour === "number"
        ? Math.round(academy.sessionRatePerHour / 100)
        : 0;
    return 0;
  }, [type, coach, venue, academy, sport]);

  const subtotal = durationHours * pricePerHour;
  // Fees come from the server that will charge them — see useBookingQuote. The
  // client no longer derives the breakdown from its own NEXT_PUBLIC_* rate copies.
  const { quote, isQuoteLoading } = useBookingQuote(subtotal, discount);
  const serviceFee = quote.serviceFee;
  const taxes = quote.tax;
  const total = quote.total;
  const finalPayableAmount =
    isGroupBooking && paymentType === "SPLIT"
      ? Math.round(total / (selectedFriendIds.length + 1))
      : total;
  // Zero-commission is a property of the quote, not of a locally-read rate.
  const isZeroCommission = serviceFee === 0;

  const hasRequiredDetails = Boolean(date && startTime && endTime && sport);
  const hasValidDuration = durationMinutes > 0;
  const isDetailsReady =
    type === "coach" ? Boolean(coach) : type === "venue" ? Boolean(venue) : Boolean(academy);

  const steps = [
    { id: 1, label: "Review" },
    { id: 2, label: "Payment" },
    { id: 3, label: "Confirm" },
  ];

  const dynamicPaymentOptions = useMemo(() => {
    const opts = [...PAYMENT_OPTIONS];
    if (walletBalance !== null) {
      opts.unshift({
        id: "wallet",
        label: "Wallet Balance",
        description: `Available: ₹${walletBalance.toFixed(2)}`,
        icon: <Wallet size={18} />,
        disabled: walletBalance < finalPayableAmount,
      });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletBalance, finalPayableAmount]);

  // The step lives in the URL, not in component state. Back steps back through
  // the flow instead of leaving it, a refresh keeps your place, and each step is
  // a distinct URL that drop-off can be attributed to. The entry guards live in
  // CHECKOUT_FLOW, so ?step=confirm in a fresh tab lands on review.
  const flow = useFlow(CHECKOUT_FLOW, {
    hasBookingDetails: hasRequiredDetails && hasValidDuration,
    hasPaymentMethod: Boolean(paymentMethod),
  });
  const currentStep = flow.number;
  const stepDir = flow.direction;

  const handleNextStep = () => {
    // Kept as explicit feedback: the guard alone would silently refuse to
    // advance, and the user needs to be told which detail is missing.
    if (!hasRequiredDetails) {
      toast.error("Missing booking details.");
      return;
    }
    if (!hasValidDuration) {
      toast.error("End time must be after start time.");
      return;
    }
    flow.next();
  };
  const handlePrevStep = () => flow.back();

  const handleApplyPromo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPromoMessage(null);
    setPromoSuccess(false);
    if (!promoCode.trim()) {
      setDiscount(0);
      setPromoMessage("Enter a promo code to apply.");
      return;
    }
    try {
      setIsApplyingPromo(true);
      const result = await bookingApi.validatePromoCode({
        code: promoCode.trim(),
        subtotal,
        hasCoach: type === "coach",
      });
      if (!result.isValid) {
        setDiscount(0);
        setPromoMessage(result.message || "This promo code is not valid.");
        return;
      }
      setDiscount(result.discountAmount);
      setPromoSuccess(true);
      setPromoMessage(result.message || "Promo applied.");
    } catch (err) {
      setDiscount(0);
      setPromoMessage(err instanceof Error ? err.message : "Unable to validate promo code.");
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleJoinWaitlist = async () => {
    try {
      setIsJoiningWaitlist(true);
      await bookingApi.joinWaitlist({
        ...(type === "coach" ? { coachId } : { venueId }),
        sport,
        date: new Date(date).toISOString(),
        startTime,
        endTime,
        alternateSlots,
      });
      toast.success("Added to waitlist.");
      setShowWaitlistPrompt(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join waitlist.");
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  const handleCheckout = async () => {
    if (user?.role !== "Player" && user?.role !== "Parent") {
      toast.error("Only player accounts can create bookings.");
      return;
    }
    if (!hasRequiredDetails) {
      toast.error("Missing booking details.");
      return;
    }
    if (!hasValidDuration) {
      toast.error("End time must be after start time.");
      return;
    }
    if (!isDetailsReady) {
      toast.error("Details are not available.");
      return;
    }
    if (isGroupBooking && selectedFriendIds.length === 0) {
      toast.error("Select at least one friend for group booking.");
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingDate = new Date(date).toISOString();
      let response;

      if (type === "coach") {
        const playerLocation = await new Promise<{
          type: "Point";
          coordinates: [number, number];
        }>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Location request timed out.")), 10000);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeout);
              resolve({
                type: "Point",
                coordinates: [pos.coords.longitude, pos.coords.latitude],
              });
            },
            (err) => {
              clearTimeout(timeout);
              reject(err);
            },
            { enableHighAccuracy: true }
          );
        });

        response =
          isGroupBooking && selectedFriendIds.length > 0
            ? await bookingApi.initiateGroupBooking({
                coachId,
                sport,
                date: bookingDate,
                startTime,
                endTime,
                playerLocation,
                promoCode: promoCode.trim() || undefined,
                invitedFriendIds: selectedFriendIds,
                paymentType,
              })
            : await bookingApi.initiateBooking({
                coachId,
                sport,
                date: bookingDate,
                startTime,
                endTime,
                playerLocation,
                promoCode: promoCode.trim() || undefined,
                dependentId: selectedDependentId || undefined,
              });
      } else if (type === "academy") {
        response = await bookingApi.initiateBooking({
          academyId,
          sport,
          date: bookingDate,
          startTime,
          endTime,
          promoCode: promoCode.trim() || undefined,
          dependentId: selectedDependentId || undefined,
        });
      } else {
        response =
          isGroupBooking && selectedFriendIds.length > 0
            ? await bookingApi.initiateGroupBooking({
                venueId,
                sport,
                date: bookingDate,
                startTime,
                endTime,
                promoCode: promoCode.trim() || undefined,
                invitedFriendIds: selectedFriendIds,
                paymentType,
              })
            : await bookingApi.initiateBooking({
                venueId,
                sport,
                date: bookingDate,
                startTime,
                endTime,
                promoCode: promoCode.trim() || undefined,
                dependentId: selectedDependentId || undefined,
              });
      }

      const bookingId = response.booking?.id;
      if (!bookingId) throw new Error("Booking could not be created");

      if (paymentMethod === "wallet") {
        await bookingApi.payWithWallet(bookingId);
        statsApi
          .trackFunnelEvent({
            eventName: "checkout_payment_completed",
            entityType: "BOOKING",
            entityId: bookingId,
            metadata: { total, paymentMethod, isGroupBooking, paymentType },
          })
          .catch(() => {});
        router.replace(`/dashboard/my-bookings?success=true&bookingId=${bookingId}`);
        return;
      }

      const phonePeInit = await bookingApi.initiatePhonePePayment(bookingId, {
        type: type === "academy" ? "venue" : type,
      });
      if (!phonePeInit?.redirectUrl) throw new Error("Payment could not be initiated");

      statsApi
        .trackFunnelEvent({
          eventName: "checkout_payment_initiated",
          entityType: "BOOKING",
          entityId: bookingId,
          metadata: { total, paymentMethod, isGroupBooking, paymentType },
        })
        .catch(() => {});
      window.location.assign(phonePeInit.redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to complete checkout.";
      if (type === "venue" && msg.toLowerCase().includes("already booked")) {
        try {
          const av = await bookingApi.getVenueAvailabilityWithAlternates(
            venueId,
            new Date(date).toISOString(),
            startTime,
            endTime
          );
          setAlternateSlots(av.data?.alternateSlots || []);
        } catch {
          setAlternateSlots([]);
        }
        setShowWaitlistPrompt(true);
      }
      statsApi
        .trackFunnelEvent({
          eventName: "checkout_payment_failed",
          entityType: "BOOKING",
          metadata: { errorMessage: msg, total, paymentMethod },
        })
        .catch(() => {});
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const entityName =
    type === "coach"
      ? coach
        ? getCoachDisplayName(coach)
        : "Coach"
      : type === "venue"
        ? venue?.name || "Venue"
        : academy?.name || "Academy";
  const entityLabel = type === "coach" ? "coach" : type === "venue" ? "venue" : "academy";
  const communityUrl = getCommunityAppUrl({
    path: "q",
    searchParams: {
      q: `${sport} ${entityLabel}`.trim() || undefined,
      sport: sport || undefined,
    },
  });
  const backHref =
    type === "coach"
      ? `/coaches/${coachId}`
      : type === "academy"
        ? `/academies/${academySlug || academyId}`
        : `/venues/${venueId}`;

  return {
    router,
    type,
    coach,
    venue,
    academy,
    user,
    setUser,
    selectedDependentId,
    setSelectedDependentId,
    loading,
    paymentMethod,
    setPaymentMethod,
    promoCode,
    setPromoCode,
    promoMessage,
    promoSuccess,
    isApplyingPromo,
    isSubmitting,
    alternateSlots,
    showWaitlistPrompt,
    setShowWaitlistPrompt,
    isJoiningWaitlist,
    isGroupBooking,
    setIsGroupBooking,
    selectedFriendIds,
    setSelectedFriendIds,
    paymentType,
    setPaymentType,

    sport,
    setSport,
    date,
    setDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,

    durationHours,
    selectedDependent,
    availableSports,
    pricePerHour,
    subtotal,
    discount,
    serviceFee,
    taxes,
    total,
    isQuoteLoading,
    isZeroCommission,

    hasRequiredDetails,
    hasValidDuration,
    isDetailsReady,
    steps,
    dynamicPaymentOptions,
    currentStep,
    stepDir,

    handleNextStep,
    handlePrevStep,
    handleApplyPromo,
    handleJoinWaitlist,
    handleCheckout,

    entityName,
    entityLabel,
    communityUrl,
    backHref,
  };
}
