"use client";

import { AnimatePresence, motion, useReducedMotion, Variants } from "framer-motion";
import {
  Calendar,
  Check,
  Clock,
  MapPin,
  ShieldCheck,
  TicketPercent,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { toast } from "@/lib/toast";
import { getCommunityAppUrl } from "@/lib/community/url";
import { authApi } from "@/modules/auth/services/auth";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  CheckoutDetailItem,
  CheckoutDetailList,
} from "@/modules/booking/components/checkout/CheckoutDetailList";
import {
  PaymentMethodOption,
  PaymentMethodSelector,
} from "@/modules/booking/components/checkout/PaymentMethodSelector";
import { GroupBookingInviteSection } from "@/modules/booking/components/GroupBookingInviteSection";
import { PaymentType } from "@/modules/booking/components/PaymentTypeSelector";
import { bookingApi } from "@/modules/booking/services/booking";
import { statsApi } from "@/modules/analytics/services/stats";
import { Button } from "@/modules/shared/ui/Button";
import { coachApi } from "@/modules/coach/services/coach";
import { CommunityInsightsCard } from "@/modules/community/components/CommunityInsightsCard";
import { venueApi } from "@/modules/venue/services/venue";
import { Coach, User, Venue } from "@/types";
import { getOwnVenueLocationDisplay } from "@/utils/location";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import { getDashboardPathByRole } from "@/utils/roleDashboard";
import { cn } from "@/utils/cn";

// ─── Animation variants ──────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

const stepVariants: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 28 : -28,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -28 : 28,
    transition: { duration: 0.25, ease: "easeIn" },
  }),
};

// ─── Constants ───────────────────────────────────────────────────────────────

const paymentOptions: PaymentMethodOption[] = [
  {
    id: "phonepe",
    label: "PhonePe",
    description: "UPI, cards, and wallets",
    icon: <Wallet size={18} />,
    badge: "Recommended",
  },
];

type BookingType = "coach" | "venue";

// ─── Utility helpers ─────────────────────────────────────────────────────────

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

const getCoachDisplayName = (coach: Coach) => {
  const userName =
    typeof coach.userId === "object" && coach.userId !== null
      ? coach.userId.name
      : "";
  return userName?.trim() || `${coach.sports?.[0] || "Coach"} Coach`;
};

const getCoachImageCandidates = (coach: Coach) => {
  const userPhoto =
    typeof coach.userId === "object" && coach.userId !== null
      ? coach.userId.photoUrl
      : "";
  return [
    coach.photoUrl,
    coach.profileImage,
    userPhoto,
    coach.ownVenueDetails?.images?.[0],
  ]
    .map((v) => normalizeImageUrl(v))
    .filter((v): v is string => Boolean(v));
};

const getCoachLocationLabel = (coach: Coach) => {
  if (coach.serviceMode === "FREELANCE") return "Freelance";
  if (coach.serviceMode === "OWN_VENUE") {
    const venueLocation = getOwnVenueLocationDisplay(coach.ownVenueDetails);
    return venueLocation ? `Own Venue · ${venueLocation.title}` : "Own Venue";
  }
  return "Hybrid";
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div>
        <h2 className="font-title text-base font-semibold text-slate-900 sm:text-lg">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function StepIndicator({
  steps,
  currentStep,
}: {
  steps: { id: number; label: string }[];
  currentStep: number;
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, index) => {
        const isComplete = currentStep > step.id;
        const isActive = currentStep === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{
                  backgroundColor: isComplete
                    ? "#E97316"
                    : isActive
                      ? "#fff"
                      : "#f8fafc",
                  borderColor: isComplete || isActive ? "#E97316" : "#e2e8f0",
                  color: isComplete ? "#fff" : isActive ? "#E97316" : "#94a3b8",
                }}
                transition={{ duration: 0.3 }}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold"
              >
                {isComplete ? <Check size={13} strokeWidth={3} /> : step.id}
              </motion.div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-slate-900" : "text-slate-400",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="mx-3 mb-5 h-px w-10 sm:w-16">
                <motion.div
                  animate={{
                    backgroundColor:
                      currentStep > step.id ? "#E97316" : "#e2e8f0",
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EntityCard({
  coach,
  venue,
  type,
}: {
  coach: Coach | null;
  venue: Venue | null;
  type: BookingType;
}) {
  if (type === "venue" && venue) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="h-24 w-full overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-40 shrink-0">
          {venue.images?.[0] ? (
            <img
              src={venue.images[0]}
              alt={venue.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-50">
              <MapPin size={22} className="text-slate-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-900 sm:text-lg">
            {venue.name}
          </p>
          {venue.address && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{venue.address}</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {venue.sports.map((s) => (
              <span
                key={s}
                className="rounded-full bg-power-orange/8 px-2.5 py-0.5 text-xs font-semibold text-power-orange"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "coach" && coach) {
    const name = getCoachDisplayName(coach);
    const img = getCoachImageCandidates(coach)[0];
    const locationLabel = getCoachLocationLabel(coach);
    const venueLocation = getOwnVenueLocationDisplay(coach.ownVenueDetails);

    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:h-28 sm:w-40 shrink-0">
          {img ? (
            <img src={img} alt={name} className="h-full w-full object-cover" />
          ) : (
            <UserIcon size={26} className="text-slate-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-900 sm:text-lg">
            {name}
          </p>
          <div className="mt-1">
            {venueLocation ? (
              <div className="flex items-start gap-1.5 text-sm text-slate-500">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <div>
                  <p>{locationLabel}</p>
                  <p className="text-xs">{venueLocation.description}</p>
                  {venueLocation.mapsUrl && (
                    <a
                      href={venueLocation.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-power-orange hover:underline"
                    >
                      Open in Maps
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin size={13} className="shrink-0" />
                {locationLabel}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {coach.rating.toFixed(1)} avg · {coach.reviewCount} reviews
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {coach.sports.slice(0, 4).map((s) => (
              <span
                key={s}
                className="rounded-full bg-power-orange/8 px-2.5 py-0.5 text-xs font-semibold text-power-orange"
              >
                {s}
              </span>
            ))}
            {coach.sports.length > 4 && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                +{coach.sports.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

  const type = (searchParams.get("type") || "venue") as BookingType;
  const coachId = searchParams.get("coachId") || "";
  const venueId = searchParams.get("venueId") || "";
  const date = searchParams.get("date") || "";
  const startTime = searchParams.get("startTime") || "";
  const endTime = searchParams.get("endTime") || "";
  const sport = searchParams.get("sport") || "";
  const dependentId = searchParams.get("dependentId") || "";

  const [coach, setCoach] = useState<Coach | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
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
  const [currentStep, setCurrentStep] = useState(1);
  const [stepDir, setStepDir] = useState(1);
  const [alternateSlots, setAlternateSlots] = useState<string[]>([]);
  const [showWaitlistPrompt, setShowWaitlistPrompt] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>("SINGLE");

  useEffect(() => {
    setSelectedDependentId(dependentId);
  }, [dependentId]);

  useEffect(() => {
    statsApi
      .trackFunnelEvent({
        eventName: "checkout_viewed",
        entityType: type.toUpperCase(),
        entityId: type === "coach" ? coachId : venueId,
        metadata: { sport, date, startTime, endTime },
        source: "WEB",
      })
      .catch(() => {});
  }, [type, coachId, venueId, sport, date, startTime, endTime]);

  useEffect(() => {
    const load = async () => {
      try {
        const [detailsResponse, profileResponse] = await Promise.all([
          type === "coach" && coachId
            ? coachApi.getCoachById(coachId)
            : type === "venue" && venueId
              ? venueApi.getVenue(venueId)
              : Promise.resolve(null),
          authApi.getProfile().catch(() => null),
        ]);

        if (type === "coach" && detailsResponse?.success)
          setCoach(detailsResponse.data as Coach);
        if (type === "venue" && detailsResponse?.success)
          setVenue(detailsResponse.data as Venue);

        if (profileResponse?.success && profileResponse.data) {
          setUser(profileResponse.data);
          if (profileResponse.data.role !== "PLAYER") {
            toast.error("Only player accounts can create bookings.");
            router.replace(getDashboardPathByRole(profileResponse.data.role));
            return;
          }
        }
      } catch {
        toast.error("Unable to load details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type, coachId, venueId]);

  const durationMinutes = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm = "0"] = startTime.split(":");
    const [eh, em = "0"] = endTime.split(":");
    return Math.max(
      0,
      parseInt(eh, 10) * 60 +
        parseInt(em, 10) -
        parseInt(sh, 10) * 60 -
        parseInt(sm, 10),
    );
  }, [startTime, endTime]);

  const durationHours = useMemo(
    () => (durationMinutes ? Number((durationMinutes / 60).toFixed(2)) : 0),
    [durationMinutes],
  );

  const selectedDependent =
    user?.dependents?.find((d) => d._id === selectedDependentId) || null;

  const pricePerHour = useMemo(() => {
    if (type === "coach" && coach) {
      return sport && coach.sportPricing?.[sport]
        ? coach.sportPricing[sport]
        : coach.hourlyRate || 0;
    }
    if (type === "venue" && venue) {
      return sport && venue.sportPricing?.[sport]
        ? venue.sportPricing[sport]
        : venue.pricePerHour || 0;
    }
    return 0;
  }, [type, coach, venue, sport]);

  const serviceFeeRate = Number(process.env.NEXT_PUBLIC_SERVICE_FEE_RATE ?? 0);
  const taxRate = Number(process.env.NEXT_PUBLIC_TAX_RATE ?? 0.05);
  const subtotal = durationHours * pricePerHour;
  const serviceFee = Math.round(
    subtotal * (Number.isFinite(serviceFeeRate) ? serviceFeeRate : 0),
  );
  const taxes =
    serviceFee > 0
      ? Math.round(serviceFee * (Number.isFinite(taxRate) ? taxRate : 0))
      : 0;
  const total = Math.max(0, subtotal + serviceFee + taxes - discount);
  const isZeroCommission = serviceFeeRate === 0;

  const hasRequiredDetails = Boolean(date && startTime && endTime && sport);
  const hasValidDuration = durationMinutes > 0;
  const isDetailsReady = type === "coach" ? Boolean(coach) : Boolean(venue);

  const bookingDetails: CheckoutDetailItem[] = [
    { label: "Date", value: date ? formatDate(date) : "Not selected" },
    {
      label: "Time",
      value:
        startTime && endTime
          ? `${formatTime(startTime)} – ${formatTime(endTime)}`
          : "Not selected",
    },
    { label: "Sport", value: sport || "Not selected" },
    {
      label: "Participant",
      value: selectedDependent ? selectedDependent.name : user?.name || "Me",
      hint: selectedDependent ? "Booking for dependent" : "Booking for self",
    },
    {
      label: "Duration",
      value: durationHours ? `${durationHours} hour(s)` : "–",
      hint: durationHours ? `${durationHours} × hourly rate` : undefined,
    },
    ...(type === "coach"
      ? [
          {
            label: "Coach",
            value: coach ? getCoachDisplayName(coach) : "Loading...",
          },
        ]
      : [{ label: "Venue", value: venue?.name || "Loading..." }]),
  ];

  const steps = [
    { id: 1, label: "Review" },
    { id: 2, label: "Payment" },
    { id: 3, label: "Confirm" },
  ];

  const goToStep = (n: number) => {
    setStepDir(n > currentStep ? 1 : -1);
    setCurrentStep(n);
  };

  const handleNextStep = () => {
    if (!hasRequiredDetails) {
      toast.error("Missing booking details.");
      return;
    }
    if (!hasValidDuration) {
      toast.error("End time must be after start time.");
      return;
    }
    goToStep(Math.min(3, currentStep + 1));
  };

  const handlePrevStep = () => goToStep(Math.max(1, currentStep - 1));

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
      setPromoMessage(
        err instanceof Error ? err.message : "Unable to validate promo code.",
      );
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
      toast.success("Added to waitlist. We will notify you of any changes.");
      setShowWaitlistPrompt(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to join waitlist.",
      );
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  const handleCheckout = async () => {
    if (user?.role !== "PLAYER") {
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
          const timeout = setTimeout(
            () => reject(new Error("Location request timed out.")),
            10000,
          );
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
            { enableHighAccuracy: true },
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

      const phonePeInit = await bookingApi.initiatePhonePePayment(bookingId, {
        type,
      });
      if (!phonePeInit?.redirectUrl)
        throw new Error("Payment could not be initiated");

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
      const msg =
        err instanceof Error ? err.message : "Unable to complete checkout.";
      if (type === "venue" && msg.toLowerCase().includes("already booked")) {
        try {
          const av = await bookingApi.getVenueAvailabilityWithAlternates(
            venueId,
            new Date(date).toISOString(),
            startTime,
            endTime,
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

  const communityUrl = getCommunityAppUrl({
    path: "q",
    searchParams: {
      q: `${sport} ${type === "coach" ? "coach" : "venue"}`.trim() || undefined,
      sport: sport || undefined,
    },
  });

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-power-orange" />
          <p className="text-sm text-slate-500">Loading your booking...</p>
        </div>
      </div>
    );
  }

  if (!isDetailsReady) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200/70 bg-white/95 p-8 text-center">
        <p className="text-sm text-slate-500">
          {type === "coach" ? "Coach" : "Venue"} not found.
        </p>
        <Button
          variant="outline"
          onClick={() => router.push(type === "coach" ? "/coaches" : "/venues")}
        >
          Browse {type === "coach" ? "coaches" : "venues"}
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Checkout" },
          ]}
        />
      </motion.div>

      {/* Page header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/60 p-6 shadow-sm backdrop-blur-sm sm:p-8"
      >
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
              Checkout
            </span>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
              {type === "coach"
                ? "Complete your coach booking"
                : "Complete your venue booking"}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Review details, choose a payment method, and confirm your slot.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={isSubmitting}
              >
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => router.back()}>
              Edit booking
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-power-orange/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-turf-green/5 blur-3xl" />
      </motion.div>

      {/* Step progress */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/95 px-5 py-4 shadow-sm backdrop-blur-sm sm:px-6"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Step {currentStep} of {steps.length}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800 sm:text-base">
            {currentStep === 1 && "Review your booking"}
            {currentStep === 2 && "Choose a payment method"}
            {currentStep === 3 && "Confirm and pay"}
          </p>
        </div>
        <StepIndicator steps={steps} currentStep={currentStep} />
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
        {/* Left — step content */}
        <div className="min-w-0">
          <AnimatePresence mode="wait" custom={stepDir}>
            <motion.div
              key={currentStep}
              custom={shouldReduceMotion ? 0 : stepDir}
              variants={shouldReduceMotion ? fadeIn : stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="space-y-4"
            >
              {/* STEP 1 */}
              {currentStep === 1 && (
                <>
                  {/* Entity overview */}
                  <SectionCard>
                    <SectionHeader
                      title={
                        type === "venue" ? "Venue overview" : "Coach overview"
                      }
                      description="Confirm the details before you pay."
                    />
                    <div className="p-5 sm:p-6">
                      <EntityCard coach={coach} venue={venue} type={type} />
                    </div>
                  </SectionCard>

                  {/* Booking details */}
                  <SectionCard>
                    <SectionHeader
                      title="Booking details"
                      description="Verify your schedule and attendee."
                      action={
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                          <Calendar size={11} />
                          {date ? formatDate(date) : "No date"}
                        </span>
                      }
                    />
                    <div className="p-5 sm:p-6 space-y-5">
                      {user?.dependents && user.dependents.length > 0 && (
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Who is attending?
                          </label>
                          <select
                            value={selectedDependentId}
                            onChange={(e) =>
                              setSelectedDependentId(e.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                          >
                            <option value="">Me ({user.name})</option>
                            {user.dependents.map((d) => (
                              <option key={d._id} value={d._id || ""}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <CheckoutDetailList items={bookingDetails} />
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-500">
                        <Clock size={13} className="shrink-0 text-slate-400" />
                        Arrive 10 minutes before your slot starts.
                      </div>
                    </div>
                  </SectionCard>
                </>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <>
                  {/* Group booking */}
                  <SectionCard>
                    <SectionHeader
                      title="Group booking"
                      description="Invite friends and split the cost."
                    />
                    <div className="p-5 sm:p-6">
                      <GroupBookingInviteSection
                        isGroupBooking={isGroupBooking}
                        onGroupBookingChange={setIsGroupBooking}
                        selectedFriendIds={selectedFriendIds}
                        onFriendSelectionChange={setSelectedFriendIds}
                        paymentType={paymentType}
                        onPaymentTypeChange={setPaymentType}
                        totalAmount={total}
                      />
                    </div>
                  </SectionCard>

                  {/* Payment method */}
                  <SectionCard>
                    <SectionHeader
                      title="Payment method"
                      description="Choose how you want to pay."
                    />
                    <div className="p-5 sm:p-6 space-y-4">
                      <PaymentMethodSelector
                        value={paymentMethod}
                        onChange={setPaymentMethod}
                        options={paymentOptions}
                      />
                    </div>
                  </SectionCard>

                  {/* Promo code */}
                  <SectionCard>
                    <SectionHeader
                      title="Promo code"
                      description="Apply a code to reduce your total."
                    />
                    <div className="p-5 sm:p-6">
                      <form
                        onSubmit={handleApplyPromo}
                        className="flex flex-col gap-3 sm:flex-row"
                      >
                        <div className="relative flex-1">
                          <TicketPercent
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Enter promo code"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                          />
                        </div>
                        <Button
                          type="submit"
                          variant="outline"
                          disabled={isApplyingPromo}
                          className="sm:w-32"
                        >
                          {isApplyingPromo ? "Applying..." : "Apply"}
                        </Button>
                      </form>
                      <AnimatePresence>
                        {promoMessage && (
                          <motion.p
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn(
                              "mt-2.5 text-xs font-medium",
                              promoSuccess
                                ? "text-turf-green"
                                : "text-slate-500",
                            )}
                          >
                            {promoMessage}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </SectionCard>
                </>
              )}

              {/* STEP 3 */}
              {currentStep === 3 && (
                <SectionCard>
                  <SectionHeader
                    title="Confirm booking"
                    description="Review your summary before payment."
                  />
                  <div className="p-5 sm:p-6 space-y-5">
                    <CheckoutDetailList items={bookingDetails} />
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-500">
                      Payment via{" "}
                      <span className="font-semibold text-slate-700">
                        {
                          paymentOptions.find((o) => o.id === paymentMethod)
                            ?.label
                        }
                      </span>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Validation notices */}
              <AnimatePresence>
                {!hasRequiredDetails && (
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
                  >
                    Missing booking details. Please go back and select a date,
                    time, and sport.
                  </motion.div>
                )}
                {hasRequiredDetails && !hasValidDuration && (
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
                  >
                    End time must be after start time.
                  </motion.div>
                )}
                {showWaitlistPrompt && (
                  <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    className="rounded-xl border border-blue-200/60 bg-blue-50/60 p-4 text-sm text-blue-700"
                  >
                    <p className="font-semibold">This slot was just taken.</p>
                    {alternateSlots.length > 0 ? (
                      <p className="mt-1 text-xs">
                        Nearby alternates: {alternateSlots.join(", ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs">
                        No nearby alternate slots right now.
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleJoinWaitlist}
                        disabled={isJoiningWaitlist}
                      >
                        {isJoiningWaitlist ? "Joining..." : "Join waitlist"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowWaitlistPrompt(false)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right — sticky sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.15 }}
            className="space-y-4"
          >
            {/* Zero commission banner */}
            {isZeroCommission && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-sky-50 p-5">
                <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-amber-200/30 blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <span className="text-sm font-extrabold text-power-orange">
                      0%
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Limited-time offer
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      Zero commission on all bookings
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      You pay only the venue or coach rate plus applicable
                      taxes.
                    </p>
                  </div>
                </div>
                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  {[
                    "No platform fee",
                    "Auto-applied",
                    "Transparent totals",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Order summary */}
            <SectionCard>
              <SectionHeader title="Order summary" />
              <div className="p-5 sm:p-6">
                <div className="space-y-3">
                  {[
                    {
                      label: type === "coach" ? "Coach rate" : "Venue rate",
                      value: `${formatCurrency(pricePerHour)}/hr`,
                    },
                    {
                      label: "Subtotal",
                      value: formatCurrency(subtotal),
                      hint: durationHours ? `${durationHours} hour(s)` : "",
                    },
                    {
                      label: isZeroCommission ? "Platform fee" : "Service fee",
                      value: formatCurrency(serviceFee),
                      hint: isZeroCommission
                        ? "Limited-time zero commission"
                        : "Platform support and protection",
                    },
                    {
                      label: "Taxes",
                      value: formatCurrency(taxes),
                      hint: "Estimated",
                    },
                    ...(discount > 0
                      ? [
                          {
                            label: "Promo discount",
                            value: `-${formatCurrency(discount)}`,
                            hint: promoCode.toUpperCase(),
                            strong: true,
                          },
                        ]
                      : []),
                  ].map((item: any) => (
                    <div
                      key={item.label}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div>
                        <p
                          className={cn(
                            "text-slate-600",
                            item.strong && "font-semibold text-turf-green",
                          )}
                        >
                          {item.label}
                        </p>
                        {item.hint && (
                          <p className="text-xs text-slate-400">{item.hint}</p>
                        )}
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-slate-900",
                          item.strong && "font-semibold text-turf-green",
                        )}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Total</span>
                    <motion.span
                      key={total}
                      initial={
                        shouldReduceMotion
                          ? false
                          : { scale: 1.08, opacity: 0.7 }
                      }
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.25 }}
                      className="text-xl font-bold text-power-orange"
                    >
                      {formatCurrency(total)}
                    </motion.span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {type === "venue"
                      ? "Your slot is reserved for 10 minutes after confirmation."
                      : "Booking confirmed after location verification."}
                  </p>
                </div>

                <div className="mt-5 space-y-2.5">
                  {currentStep > 1 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handlePrevStep}
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    className="w-full"
                    disabled={
                      !hasRequiredDetails ||
                      !hasValidDuration ||
                      isSubmitting ||
                      total <= 0
                    }
                    loading={currentStep === 3 ? isSubmitting : false}
                    onClick={
                      currentStep === 3 ? handleCheckout : handleNextStep
                    }
                  >
                    {currentStep === 1 && "Continue to payment"}
                    {currentStep === 2 && "Review and confirm"}
                    {currentStep === 3 && "Pay and confirm"}
                  </Button>
                </div>
              </div>
            </SectionCard>

            {/* Security */}
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                <ShieldCheck size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Protected checkout
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Payments are encrypted. You can reschedule from your dashboard
                  if needed.
                </p>
              </div>
            </div>

            {/* Community insights */}
            <CommunityInsightsCard
              title="Second opinion before paying?"
              description={`See what players are saying about this ${type === "coach" ? "coach" : "venue"} before you confirm.`}
              q={`${sport} ${type === "coach" ? "coach" : "venue"}`}
              sport={sport}
              ctaUrl={communityUrl}
              enabled={Boolean(user?.role === "PLAYER")}
            />
          </motion.div>
        </aside>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-power-orange" />
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
