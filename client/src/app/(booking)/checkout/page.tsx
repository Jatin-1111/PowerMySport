"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  Variants,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  CreditCard,
  IndianRupee,
  MapPin,
  ShieldCheck,
  Star,
  TicketPercent,
  User as UserIcon,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { toast } from "@/lib/toast";
import { getCommunityAppUrl } from "@/lib/community/url";
import { authApi } from "@/modules/auth/services/auth";
import {
  PaymentMethodOption,
  PaymentMethodSelector,
} from "@/modules/booking/components/checkout/PaymentMethodSelector";
import { GroupBookingInviteSection } from "@/modules/booking/components/GroupBookingInviteSection";
import { PaymentType } from "@/modules/booking/components/PaymentTypeSelector";
import { bookingApi } from "@/modules/booking/services/booking";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { OnboardingAcademy } from "@/modules/onboarding/types/academy";
import { walletApi } from "@/modules/wallet/services/wallet";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingType = "coach" | "venue" | "academy";

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
};

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -28 : 28, transition: { duration: 0.25, ease: "easeIn" } }),
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS: PaymentMethodOption[] = [
  {
    id: "phonepe",
    label: "PhonePe",
    description: "UPI, cards, and wallets",
    icon: <Wallet size={18} />,
    badge: "Recommended",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeImageUrl = (value?: string) => {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/") || trimmed.startsWith("data:image")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.includes("amazonaws.com")) return `https://${trimmed}`;
  return trimmed;
};

const getCoachDisplayName = (coach: Coach) => {
  const userName = typeof coach.userId === "object" && coach.userId !== null ? coach.userId.name : "";
  return userName?.trim() || `${coach.sports?.[0] || "Coach"} Coach`;
};

const getCoachImageCandidates = (coach: Coach) => {
  const userPhoto = typeof coach.userId === "object" && coach.userId !== null ? coach.userId.photoUrl : "";
  return [coach.photoUrl, coach.profileImage, userPhoto, coach.ownVenueDetails?.images?.[0]].map((v) => normalizeImageUrl(v)).filter((v): v is string => Boolean(v));
};

const getCoachLocationLabel = (coach: Coach) => {
  if (coach.serviceMode === "FREELANCE") return "Freelance";
  if (coach.serviceMode === "OWN_VENUE") {
    const loc = getOwnVenueLocationDisplay(coach.ownVenueDetails);
    return loc ? `Own Venue · ${loc.title}` : "Own Venue";
  }
  return "Hybrid";
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-sm", className)}>{children}</div>;
}

function SectionHeader({
  title, description, action, icon, step,
}: {
  title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode; step?: number;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        {step !== undefined && (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-power-orange text-xs font-bold text-white">{step}</span>
        )}
        {icon && !step && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>
        )}
        <div>
          <h2 className="font-title text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function StepPill({ steps, currentStep }: { steps: { id: number; label: string }[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const isComplete = currentStep > step.id;
        const isActive = currentStep === step.id;
        return (
          <div key={step.id} className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ backgroundColor: isComplete ? "#E97316" : isActive ? "#fff" : "#f1f5f9", borderColor: isComplete || isActive ? "#E97316" : "#e2e8f0", color: isComplete ? "#fff" : isActive ? "#E97316" : "#94a3b8" }}
                transition={{ duration: 0.3 }}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold"
              >
                {isComplete ? <Check size={12} strokeWidth={3} /> : step.id}
              </motion.div>
              <span className={cn("hidden text-xs font-semibold sm:inline", isActive ? "text-slate-800" : isComplete ? "text-power-orange" : "text-slate-400")}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <motion.div animate={{ backgroundColor: currentStep > step.id ? "#E97316" : "#e2e8f0" }} transition={{ duration: 0.3 }} className="mx-1 h-px w-6 sm:w-10" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function BookingSummaryRow({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3.5 py-3 border-b border-slate-100 last:border-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

function EntityCard({ coach, venue, academy, type }: { coach: Coach | null; venue: Venue | null; academy: AcademyCard | null; type: BookingType }) {
  if (type === "venue" && venue) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-32 w-full overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-44 shrink-0">
          {venue.images?.[0] ? (
            <img src={venue.images[0]} alt={venue.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200"><MapPin size={28} className="text-slate-300" /></div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-slate-900">{venue.name}</p>
          {venue.address && <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0 text-power-orange" /><span>{venue.address}</span></p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {venue.sports.map((s) => <span key={s} className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-semibold text-power-orange">{s}</span>)}
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
        <div className="relative h-32 w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:h-32 sm:w-44 shrink-0">
          {img ? <img src={img} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200"><UserIcon size={32} className="text-slate-300" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-slate-900">{name}</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" /><span className="text-sm font-semibold text-slate-700">{coach.rating.toFixed(1)}</span></div>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-500">{coach.reviewCount} reviews</span>
          </div>
          <div className="mt-2">
            {venueLocation ? (
              <div className="flex items-start gap-1.5 text-sm text-slate-500">
                <MapPin size={13} className="mt-0.5 shrink-0 text-power-orange" />
                <div>
                  <p>{locationLabel}</p>
                  <p className="text-xs text-slate-400">{venueLocation.description}</p>
                  {venueLocation.mapsUrl && <a href={venueLocation.mapsUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-power-orange hover:underline">Open in Maps →</a>}
                </div>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={13} className="shrink-0 text-power-orange" />{locationLabel}</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {coach.sports.slice(0, 4).map((s) => <span key={s} className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-semibold text-power-orange">{s}</span>)}
            {coach.sports.length > 4 && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500">+{coach.sports.length - 4} more</span>}
          </div>
        </div>
      </div>
    );
  }

  if (type === "academy" && academy) {
    const coverImage = normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl);
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-32 w-full overflow-hidden rounded-xl bg-slate-100 sm:h-32 sm:w-44 shrink-0">
          {coverImage ? <img src={coverImage} alt={academy.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200"><Users size={32} className="text-slate-300" /></div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-lg font-bold text-slate-900">{academy.name}</p>
            {(academy.kycVerified || academy.isApproved) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <BadgeCheck size={10} />Verified
              </span>
            )}
          </div>
          {academy.city && <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0 text-power-orange" /><span>{academy.city}</span></p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(academy.sports || []).slice(0, 4).map((s) => <span key={s} className="rounded-full bg-power-orange/10 px-2.5 py-0.5 text-xs font-semibold text-power-orange">{s}</span>)}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main checkout page ───────────────────────────────────────────────────────

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

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
  const [currentStep, setCurrentStep] = useState(1);
  const [stepDir, setStepDir] = useState(1);
  const [alternateSlots, setAlternateSlots] = useState<string[]>([]);
  const [showWaitlistPrompt, setShowWaitlistPrompt] = useState(false);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [isGroupBooking, setIsGroupBooking] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>("SINGLE");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => { setSelectedDependentId(dependentId); }, [dependentId]);

  useEffect(() => {
    statsApi.trackFunnelEvent({
      eventName: "checkout_viewed",
      entityType: type.toUpperCase(),
      entityId: type === "coach" ? coachId : type === "academy" ? academyId : venueId,
      metadata: { sport, date, startTime, endTime },
      source: "WEB",
    }).catch(() => {});
  }, [type, coachId, venueId, academyId, sport, date, startTime, endTime]);

  useEffect(() => {
    const load = async () => {
      try {
        const entityFetch =
          type === "coach" && coachId ? coachApi.getCoachById(coachId)
          : type === "venue" && venueId ? venueApi.getVenue(venueId)
          : type === "academy" && (academySlug || academyId) ? academyOnboardingApi.getAcademyProfile(academySlug || academyId)
          : Promise.resolve(null);

        const [entityResp, profileResp, walletResp] = await Promise.all([
          entityFetch,
          authApi.getProfile().catch(() => null),
          walletApi.getWallet().catch(() => null),
        ]);

        if (type === "coach" && entityResp?.success) setCoach(entityResp.data as Coach);
        if (type === "venue" && entityResp?.success) setVenue(entityResp.data as Venue);
        if (type === "academy" && entityResp?.success) setAcademy(entityResp.data as AcademyCard);

        if (profileResp?.success && profileResp.data) {
          setUser(profileResp.data);
          if (profileResp.data.role !== "Player" && profileResp.data.role !== "Parent") {
            toast.error("Only player accounts can create bookings.");
            router.replace(getDashboardPathByRole(profileResp.data.role));
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
  }, [type, coachId, venueId, academyId, academySlug]);

  const durationMinutes = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [sh, sm = "0"] = startTime.split(":");
    const [eh, em = "0"] = endTime.split(":");
    return Math.max(0, parseInt(eh, 10) * 60 + parseInt(em, 10) - parseInt(sh, 10) * 60 - parseInt(sm, 10));
  }, [startTime, endTime]);

  const durationHours = useMemo(() => (durationMinutes ? Number((durationMinutes / 60).toFixed(2)) : 0), [durationMinutes]);

  const selectedDependent = user?.dependents?.find((d) => d._id === selectedDependentId) || null;

  const availableSports = useMemo(() => {
    if (type === "coach" && coach) return coach.sports || [];
    if (type === "venue" && venue) return venue.sports || [];
    if (type === "academy" && academy) return academy.sports || [];
    return [];
  }, [type, coach, venue, academy]);

  const pricePerHour = useMemo(() => {
    if (type === "coach" && coach) return sport && coach.sportPricing?.[sport] ? coach.sportPricing[sport] : coach.hourlyRate || 0;
    if (type === "venue" && venue) return sport && venue.sportPricing?.[sport] ? venue.sportPricing[sport] : venue.pricePerHour || 0;
    if (type === "academy" && academy) return typeof academy.sessionRatePerHour === "number" ? Math.round(academy.sessionRatePerHour / 100) : 0;
    return 0;
  }, [type, coach, venue, academy, sport]);

  const serviceFeeRate = Number(process.env.NEXT_PUBLIC_SERVICE_FEE_RATE ?? 0);
  const taxRate = Number(process.env.NEXT_PUBLIC_TAX_RATE ?? 0.05);
  const subtotal = durationHours * pricePerHour;
  const serviceFee = Math.round(subtotal * (Number.isFinite(serviceFeeRate) ? serviceFeeRate : 0));
  const taxes = serviceFee > 0 ? Math.round(serviceFee * (Number.isFinite(taxRate) ? taxRate : 0)) : 0;
  const total = Math.max(0, subtotal + serviceFee + taxes - discount);
  const finalPayableAmount = isGroupBooking && paymentType === "SPLIT" ? Math.round(total / (selectedFriendIds.length + 1)) : total;
  const isZeroCommission = serviceFeeRate === 0;

  const hasRequiredDetails = Boolean(date && startTime && endTime && sport);
  const hasValidDuration = durationMinutes > 0;
  const isDetailsReady = type === "coach" ? Boolean(coach) : type === "venue" ? Boolean(venue) : Boolean(academy);

  const steps = [{ id: 1, label: "Review" }, { id: 2, label: "Payment" }, { id: 3, label: "Confirm" }];

  const dynamicPaymentOptions = useMemo(() => {
    const opts = [...PAYMENT_OPTIONS];
    if (walletBalance !== null) {
      opts.unshift({ id: "wallet", label: "Wallet Balance", description: `Available: ₹${walletBalance.toFixed(2)}`, icon: <Wallet size={18} />, disabled: walletBalance < finalPayableAmount });
    }
    return opts;
  }, [walletBalance, finalPayableAmount]);

  const goToStep = (n: number) => { setStepDir(n > currentStep ? 1 : -1); setCurrentStep(n); };
  const handleNextStep = () => { if (!hasRequiredDetails) { toast.error("Missing booking details."); return; } if (!hasValidDuration) { toast.error("End time must be after start time."); return; } goToStep(Math.min(3, currentStep + 1)); };
  const handlePrevStep = () => goToStep(Math.max(1, currentStep - 1));

  const handleApplyPromo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPromoMessage(null);
    setPromoSuccess(false);
    if (!promoCode.trim()) { setDiscount(0); setPromoMessage("Enter a promo code to apply."); return; }
    try {
      setIsApplyingPromo(true);
      const result = await bookingApi.validatePromoCode({ code: promoCode.trim(), subtotal, hasCoach: type === "coach" });
      if (!result.isValid) { setDiscount(0); setPromoMessage(result.message || "This promo code is not valid."); return; }
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
      await bookingApi.joinWaitlist({ ...(type === "coach" ? { coachId } : { venueId }), sport, date: new Date(date).toISOString(), startTime, endTime, alternateSlots });
      toast.success("Added to waitlist.");
      setShowWaitlistPrompt(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join waitlist.");
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  const handleCheckout = async () => {
    if (user?.role !== "Player" && user?.role !== "Parent") { toast.error("Only player accounts can create bookings."); return; }
    if (!hasRequiredDetails) { toast.error("Missing booking details."); return; }
    if (!hasValidDuration) { toast.error("End time must be after start time."); return; }
    if (!isDetailsReady) { toast.error("Details are not available."); return; }
    if (isGroupBooking && selectedFriendIds.length === 0) { toast.error("Select at least one friend for group booking."); return; }

    setIsSubmitting(true);
    try {
      const bookingDate = new Date(date).toISOString();
      let response;

      if (type === "coach") {
        const playerLocation = await new Promise<{ type: "Point"; coordinates: [number, number] }>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Location request timed out.")), 10000);
          navigator.geolocation.getCurrentPosition(
            (pos) => { clearTimeout(timeout); resolve({ type: "Point", coordinates: [pos.coords.longitude, pos.coords.latitude] }); },
            (err) => { clearTimeout(timeout); reject(err); },
            { enableHighAccuracy: true },
          );
        });

        response = isGroupBooking && selectedFriendIds.length > 0
          ? await bookingApi.initiateGroupBooking({ coachId, sport, date: bookingDate, startTime, endTime, playerLocation, promoCode: promoCode.trim() || undefined, invitedFriendIds: selectedFriendIds, paymentType })
          : await bookingApi.initiateBooking({ coachId, sport, date: bookingDate, startTime, endTime, playerLocation, promoCode: promoCode.trim() || undefined, dependentId: selectedDependentId || undefined });
      } else if (type === "academy") {
        response = await bookingApi.initiateBooking({ academyId, sport, date: bookingDate, startTime, endTime, promoCode: promoCode.trim() || undefined, dependentId: selectedDependentId || undefined });
      } else {
        response = isGroupBooking && selectedFriendIds.length > 0
          ? await bookingApi.initiateGroupBooking({ venueId, sport, date: bookingDate, startTime, endTime, promoCode: promoCode.trim() || undefined, invitedFriendIds: selectedFriendIds, paymentType })
          : await bookingApi.initiateBooking({ venueId, sport, date: bookingDate, startTime, endTime, promoCode: promoCode.trim() || undefined, dependentId: selectedDependentId || undefined });
      }

      const bookingId = response.booking?.id;
      if (!bookingId) throw new Error("Booking could not be created");

      if (paymentMethod === "wallet") {
        await bookingApi.payWithWallet(bookingId);
        statsApi.trackFunnelEvent({ eventName: "checkout_payment_completed", entityType: "BOOKING", entityId: bookingId, metadata: { total, paymentMethod, isGroupBooking, paymentType } }).catch(() => {});
        router.replace(`/dashboard/bookings/${bookingId}?success=true`);
        return;
      }

      const phonePeInit = await bookingApi.initiatePhonePePayment(bookingId, { type: type === "academy" ? "venue" : type });
      if (!phonePeInit?.redirectUrl) throw new Error("Payment could not be initiated");

      statsApi.trackFunnelEvent({ eventName: "checkout_payment_initiated", entityType: "BOOKING", entityId: bookingId, metadata: { total, paymentMethod, isGroupBooking, paymentType } }).catch(() => {});
      window.location.assign(phonePeInit.redirectUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to complete checkout.";
      if (type === "venue" && msg.toLowerCase().includes("already booked")) {
        try {
          const av = await bookingApi.getVenueAvailabilityWithAlternates(venueId, new Date(date).toISOString(), startTime, endTime);
          setAlternateSlots(av.data?.alternateSlots || []);
        } catch { setAlternateSlots([]); }
        setShowWaitlistPrompt(true);
      }
      statsApi.trackFunnelEvent({ eventName: "checkout_payment_failed", entityType: "BOOKING", metadata: { errorMessage: msg, total, paymentMethod } }).catch(() => {});
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const entityName = type === "coach" ? (coach ? getCoachDisplayName(coach) : "Coach") : type === "venue" ? (venue?.name || "Venue") : (academy?.name || "Academy");
  const entityLabel = type === "coach" ? "coach" : type === "venue" ? "venue" : "academy";
  const communityUrl = getCommunityAppUrl({ path: "q", searchParams: { q: `${sport} ${entityLabel}`.trim() || undefined, sport: sport || undefined } });
  const backHref = type === "coach" ? `/coaches/${coachId}` : type === "academy" ? `/academies/${academySlug || academyId}` : `/venues/${venueId}`;

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
        <p className="text-sm text-slate-500 capitalize">{entityLabel} not found.</p>
        <Button variant="outline" onClick={() => router.push("/booking")}>Browse options</Button>
      </div>
    );
  }

  const ctaButtons = (
    <div className="flex shrink-0 gap-2 lg:mt-4 lg:w-full lg:flex-col lg:space-y-2.5">
      {currentStep > 1 && <Button variant="outline" className="hidden lg:flex w-full" onClick={handlePrevStep} disabled={isSubmitting}><ChevronLeft size={16} />Back</Button>}
      <Button variant="primary" className="w-[180px] lg:w-full gap-2"
        disabled={!hasRequiredDetails || !hasValidDuration || isSubmitting || total <= 0}
        loading={currentStep === 3 ? isSubmitting : false}
        onClick={currentStep === 3 ? handleCheckout : handleNextStep}>
        {currentStep === 1 && <><span>Continue</span><ArrowRight size={15} /></>}
        {currentStep === 2 && <><span>Confirm</span><ArrowRight size={15} /></>}
        {currentStep === 3 && <><span>Pay <span className="hidden lg:inline">{formatCurrency(total)}</span></span><ArrowRight size={15} /></>}
      </Button>
    </div>
  );

  return (
    <div className="space-y-5 pb-28 lg:pb-0">
      {/* Back link */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Button variant="ghost" onClick={() => router.push(backHref)} className="text-slate-600">
          <ArrowLeft size={16} className="mr-2" />Back to {entityLabel}
        </Button>
      </motion.div>

      {/* Page header */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-10 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-1/3 h-32 w-32 rounded-full bg-turf-green/15 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-power-orange/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-power-orange">
                <Zap size={11} />Secure Checkout
              </span>
              {isZeroCommission && <span className="inline-flex items-center gap-1.5 rounded-full bg-turf-green/20 px-3 py-1 text-xs font-semibold text-turf-green">0% Platform Fee</span>}
            </div>
            <h1 className="mt-3 font-title text-2xl font-bold text-white sm:text-3xl">
              {type === "coach" ? "Book your coach session" : type === "academy" ? "Book an academy session" : "Reserve your venue slot"}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">Review details, pick a payment method, and confirm your slot.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {currentStep > 1 && <Button variant="outline" onClick={handlePrevStep} disabled={isSubmitting} className="border-white/20 bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={16} />Back</Button>}
            <Button variant="outline" onClick={() => router.push(backHref)} className="border-white/20 bg-white/10 text-white hover:bg-white/20">Back to booking</Button>
          </div>
        </div>

        <div className="relative z-10 mt-6 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Step {currentStep} of {steps.length}</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {currentStep === 1 && "Review your booking"}
              {currentStep === 2 && "Choose payment method"}
              {currentStep === 3 && "Confirm and pay"}
            </p>
          </div>
          <StepPill steps={steps} currentStep={currentStep} />
        </div>
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
        {/* Left — step content */}
        <div className="min-w-0">
          <AnimatePresence mode="wait" custom={stepDir}>
            <motion.div key={currentStep} custom={shouldReduceMotion ? 0 : stepDir}
              variants={shouldReduceMotion ? fadeIn : stepVariants}
              initial="enter" animate="center" exit="exit" className="space-y-4">

              {/* STEP 1: Review */}
              {currentStep === 1 && (
                <>
                  <SectionCard>
                    <SectionHeader step={1} title={`${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} overview`} description="Confirm who you're booking with." />
                    <div className="p-5 sm:p-6">
                      <EntityCard coach={coach} venue={venue} academy={academy} type={type} />
                    </div>
                  </SectionCard>

                  <SectionCard>
                    <SectionHeader step={2} title="Booking details" description="Choose your sport, date, and time." />
                    <div className="p-5 sm:p-6 space-y-4">
                      {/* Sport */}
                      <div>
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><Zap size={12} />Sport</label>
                        {availableSports.length > 0 ? (
                          <select value={sport} onChange={(e) => setSport(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20">
                            <option value="">Select sport</option>
                            {availableSports.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={sport} onChange={(e) => setSport(e.target.value)} placeholder="e.g. Cricket, Football"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20" />
                        )}
                      </div>
                      {/* Date */}
                      <div>
                        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><Calendar size={12} />Date</label>
                        <input type="date" value={date} min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20" />
                      </div>
                      {/* Start / End time */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><Clock size={12} />Start time</label>
                          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20" />
                        </div>
                        <div>
                          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><Clock size={12} />End time</label>
                          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20" />
                        </div>
                      </div>
                      {durationHours > 0 && (
                        <p className="text-xs text-slate-500">Duration: <span className="font-semibold text-slate-700">{durationHours} hr{durationHours !== 1 ? "s" : ""}</span></p>
                      )}
                      {/* Attendee */}
                      {user?.dependents && user.dependents.length > 0 && (
                        <div>
                          <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500"><Users size={12} />Who is attending?</label>
                          <select value={selectedDependentId} onChange={(e) => setSelectedDependentId(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20">
                            <option value="">Me ({user.name})</option>
                            {user.dependents.map((d) => <option key={d._id} value={d._id || ""}>{d.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
                        <Clock size={13} className="shrink-0 text-amber-500" />
                        <p className="text-xs font-medium text-amber-700">Arrive 10 minutes before your slot starts.</p>
                      </div>
                    </div>
                  </SectionCard>
                </>
              )}

              {/* STEP 2: Payment */}
              {currentStep === 2 && (
                <>
                  {type !== "academy" && (
                    <SectionCard>
                      <SectionHeader step={1} icon={<Users size={15} />} title="Group booking" description="Invite friends and split the cost." />
                      <div className="p-5 sm:p-6">
                        <GroupBookingInviteSection
                          isGroupBooking={isGroupBooking} onGroupBookingChange={setIsGroupBooking}
                          selectedFriendIds={selectedFriendIds} onFriendSelectionChange={setSelectedFriendIds}
                          paymentType={paymentType} onPaymentTypeChange={setPaymentType} totalAmount={total} />
                      </div>
                    </SectionCard>
                  )}
                  <SectionCard>
                    <SectionHeader step={type !== "academy" ? 2 : 1} icon={<CreditCard size={15} />} title="Payment method" description="Choose how you want to pay." />
                    <div className="p-5 sm:p-6 space-y-4">
                      <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} options={dynamicPaymentOptions} />
                    </div>
                  </SectionCard>
                </>
              )}

              {/* STEP 3: Confirm */}
              {currentStep === 3 && (
                <SectionCard>
                  <SectionHeader step={1} title="Confirm booking" description="Final review before payment." />
                  <div className="p-5 sm:p-6 space-y-5">
                    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                        {type === "coach" && coach && getCoachImageCandidates(coach)[0] ? (
                          <img src={getCoachImageCandidates(coach)[0]} alt={entityName} className="h-full w-full object-cover" />
                        ) : type === "venue" && venue?.images?.[0] ? (
                          <img src={venue.images[0]} alt={venue.name} className="h-full w-full object-cover" />
                        ) : type === "academy" && academy ? (
                          normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl)
                            ? <img src={normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl)} alt={academy.name} className="h-full w-full object-cover" />
                            : <div className="flex h-full w-full items-center justify-center"><Users size={18} className="text-slate-400" /></div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center"><MapPin size={18} className="text-slate-400" /></div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{entityName}</p>
                        <p className="text-xs text-slate-500">{sport && `${sport} · `}{date ? formatDate(date) : ""}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4">
                      <BookingSummaryRow icon={<Calendar size={15} />} label="Date" value={date ? formatDate(date) : "Not selected"} />
                      <BookingSummaryRow icon={<Clock size={15} />} label="Time" value={startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : "Not selected"} hint={durationHours ? `${durationHours} hour(s)` : undefined} />
                      <BookingSummaryRow icon={<UserIcon size={15} />} label="Participant" value={selectedDependent ? selectedDependent.name : user?.name || "Me"} />
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <Wallet size={16} className="shrink-0 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-400">Paying with</p>
                        <p className="text-sm font-semibold text-slate-800">{dynamicPaymentOptions.find((o) => o.id === paymentMethod)?.label}</p>
                      </div>
                      <span className="ml-auto rounded-full bg-turf-green/10 px-2.5 py-0.5 text-xs font-semibold text-turf-green">Encrypted</span>
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Validation notices */}
              <AnimatePresence>
                {!hasRequiredDetails && (
                  <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold">!</span>
                    Missing booking details. Go back and select a date, time, and sport.
                  </motion.div>
                )}
                {hasRequiredDetails && !hasValidDuration && (
                  <motion.div variants={fadeIn} initial="hidden" animate="show" exit="hidden" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold">!</span>
                    End time must be after start time.
                  </motion.div>
                )}
                {showWaitlistPrompt && (
                  <motion.div variants={fadeUp} initial="hidden" animate="show" exit="hidden" className="rounded-xl border border-indigo-200/60 bg-indigo-50/80 p-4">
                    <p className="text-sm font-semibold text-blue-800">This slot was just taken.</p>
                    {alternateSlots.length > 0 ? <p className="mt-1 text-xs text-indigo-600">Nearby alternates: {alternateSlots.join(", ")}</p> : <p className="mt-1 text-xs text-indigo-600">No nearby alternate slots right now.</p>}
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleJoinWaitlist} disabled={isJoiningWaitlist}>{isJoiningWaitlist ? "Joining..." : "Join waitlist"}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowWaitlistPrompt(false)}>Dismiss</Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right — sticky sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.15 }} className="space-y-4">
            {isZeroCommission && (
              <div className="relative overflow-hidden rounded-2xl border border-turf-green/20 bg-gradient-to-br from-turf-green/5 via-white to-emerald-50/40 p-4">
                <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-turf-green/10 blur-xl" />
                <div className="relative flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-turf-green/10"><span className="text-xs font-extrabold text-turf-green">0%</span></div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Limited offer</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">Zero platform commission</p>
                    <p className="mt-0.5 text-xs text-slate-500">You pay only the rate plus taxes.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Promo code */}
            <SectionCard>
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-2">
                <TicketPercent size={16} className="text-slate-500" />
                <h2 className="font-title text-base font-semibold text-slate-900">Offers & Promos</h2>
              </div>
              <div className="p-4 sm:p-5">
                <form onSubmit={handleApplyPromo} className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <TicketPercent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Enter promo code"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20 uppercase" />
                    </div>
                    <Button type="submit" variant="outline" disabled={isApplyingPromo} className="w-auto px-4">{isApplyingPromo ? "..." : "Apply"}</Button>
                  </div>
                </form>
                <AnimatePresence>
                  {promoMessage && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                      className={cn("mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium", promoSuccess ? "bg-turf-green/10 text-turf-green" : "bg-slate-100 text-slate-500")}>
                      {promoSuccess && <CheckCircle2 size={13} className="shrink-0" />}
                      {promoMessage}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </SectionCard>

            {/* Order summary */}
            <SectionCard>
              <SectionHeader title="Order summary" />
              <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                <div className="space-y-2.5">
                  {[
                    { label: type === "coach" ? "Coach rate" : type === "academy" ? "Academy rate" : "Venue rate", value: `${formatCurrency(pricePerHour)}/hr`, sub: null },
                    { label: "Subtotal", value: formatCurrency(subtotal), sub: durationHours ? `${durationHours} hr` : null },
                    { label: isZeroCommission ? "Platform fee" : "Service fee", value: formatCurrency(serviceFee), sub: isZeroCommission ? "Free" : null },
                    { label: "Taxes", value: formatCurrency(taxes), sub: "Estimated" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="text-slate-600">{item.label}</p>
                        {item.sub && <p className="text-xs text-slate-400">{item.sub}</p>}
                      </div>
                      <p className="shrink-0 font-medium text-slate-800">{item.value}</p>
                    </div>
                  ))}
                  {discount > 0 && (
                    <div className="flex items-start justify-between gap-3 rounded-lg bg-turf-green/8 px-2.5 py-2 text-sm">
                      <div><p className="font-semibold text-turf-green">Promo discount</p><p className="text-xs text-turf-green/70">{promoCode.toUpperCase()}</p></div>
                      <p className="shrink-0 font-semibold text-turf-green">-{formatCurrency(discount)}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-xl bg-gradient-to-r from-power-orange/8 to-amber-50/60 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Total due</span>
                    <motion.span key={total} initial={shouldReduceMotion ? false : { scale: 1.08, opacity: 0.7 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }} className="text-2xl font-bold text-power-orange">
                      {formatCurrency(total)}
                    </motion.span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {type === "venue" ? "Slot reserved for 10 min after confirmation." : "Confirmed after payment."}
                  </p>
                </div>
              </div>
            </SectionCard>

            <div className="hidden lg:block mt-6">{ctaButtons}</div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><ShieldCheck size={16} /></span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Protected checkout</p>
                <p className="mt-0.5 text-xs text-slate-500">Payments are 256-bit encrypted. Reschedule any time from your dashboard.</p>
              </div>
            </div>

            <CommunityInsightsCard
              title="Second opinion before paying?"
              description={`See what players are saying about this ${entityLabel} before you confirm.`}
              q={`${sport} ${entityLabel}`} sport={sport} ctaUrl={communityUrl}
              enabled={Boolean(user?.role === "Player")} />
          </motion.div>
        </aside>
      </div>

      {/* Mobile Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-slate-500 font-medium">Total due</p>
            <p className="text-lg font-bold text-slate-900 leading-none mt-0.5">{formatCurrency(total)}</p>
          </div>
          {ctaButtons}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-power-orange" />
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
