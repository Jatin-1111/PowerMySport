"use client";

import {
  Calendar,
  Clock,
  CreditCard,
  MapPin,
  ShieldCheck,
  Smartphone,
  TicketPercent,
  Wallet,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import {
  CheckoutDetailItem,
  CheckoutDetailList,
} from "@/modules/booking/components/checkout/CheckoutDetailList";
import { CheckoutSection } from "@/modules/booking/components/checkout/CheckoutSection";
import { CheckoutShell } from "@/modules/booking/components/checkout/CheckoutShell";
import {
  CheckoutSummary,
  CheckoutSummaryItem,
} from "@/modules/booking/components/checkout/CheckoutSummary";
import {
  PaymentMethodOption,
  PaymentMethodSelector,
} from "@/modules/booking/components/checkout/PaymentMethodSelector";
import { bookingApi } from "@/modules/booking/services/booking";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { coachApi } from "@/modules/coach/services/coach";
import { venueApi } from "@/modules/venue/services/venue";
import { Coach, User, Venue } from "@/types";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";
import { getDashboardPathByRole } from "@/utils/roleDashboard";

const paymentOptions: PaymentMethodOption[] = [
  {
    id: "card",
    label: "Card",
    description: "Visa, Mastercard, Amex",
    icon: <CreditCard size={18} />,
  },
  {
    id: "upi",
    label: "UPI",
    description: "Instant bank transfer",
    icon: <Smartphone size={18} />,
    badge: "Fast",
  },
  {
    id: "wallet",
    label: "Wallet",
    description: "Paytm, PhonePe, Amazon Pay",
    icon: <Wallet size={18} />,
  },
];

type BookingType = "coach" | "venue";

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query params
  const type = (searchParams.get("type") || "venue") as BookingType;
  const coachId = searchParams.get("coachId") || "";
  const venueId = searchParams.get("venueId") || "";
  const date = searchParams.get("date") || "";
  const startTime = searchParams.get("startTime") || "";
  const endTime = searchParams.get("endTime") || "";
  const sport = searchParams.get("sport") || "";
  const dependentId = searchParams.get("dependentId") || "";

  // State
  const [coach, setCoach] = useState<Coach | null>(null);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedDependentId, setSelectedDependentId] = useState(dependentId);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    setSelectedDependentId(dependentId);
  }, [dependentId]);

  // Load coach or venue details
  useEffect(() => {
    const loadDetails = async () => {
      try {
        const [detailsResponse, profileResponse] = await Promise.all([
          type === "coach" && coachId
            ? coachApi.getCoachById(coachId)
            : type === "venue" && venueId
              ? venueApi.getVenue(venueId)
              : Promise.resolve(null),
          authApi.getProfile().catch(() => null),
        ]);

        if (type === "coach" && detailsResponse) {
          if (detailsResponse.success && detailsResponse.data) {
            setCoach(detailsResponse.data as Coach);
          } else {
            toast.error("Unable to load coach details");
          }
        }

        if (type === "venue" && detailsResponse) {
          if (detailsResponse.success && detailsResponse.data) {
            setVenue(detailsResponse.data as Venue);
          } else {
            toast.error("Unable to load venue details");
          }
        }

        if (profileResponse?.success && profileResponse.data) {
          setUser(profileResponse.data);

          if (profileResponse.data.role !== "PLAYER") {
            toast.error("Only player accounts can create bookings.");
            router.replace(getDashboardPathByRole(profileResponse.data.role));
            return;
          }
        }
      } catch (error) {
        console.error("Failed to load details:", error);
        toast.error("Unable to load details");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [type, coachId, venueId]);

  // Duration calculation
  const durationMinutes = useMemo(() => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMinute = "0"] = startTime.split(":");
    const [endHour, endMinute = "0"] = endTime.split(":");
    const startTotal = parseInt(startHour, 10) * 60 + parseInt(startMinute, 10);
    const endTotal = parseInt(endHour, 10) * 60 + parseInt(endMinute, 10);
    return Math.max(0, endTotal - startTotal);
  }, [startTime, endTime]);

  const durationHours = useMemo(() => {
    if (!durationMinutes) return 0;
    return Number((durationMinutes / 60).toFixed(2));
  }, [durationMinutes]);

  const selectedDependent =
    user?.dependents?.find(
      (dependent) => dependent._id === selectedDependentId,
    ) || null;

  // Price calculation
  const getPricePerHour = () => {
    if (type === "coach" && coach) {
      if (sport && coach.sportPricing && coach.sportPricing[sport]) {
        return coach.sportPricing[sport];
      }
      return coach.hourlyRate || 0;
    } else if (type === "venue" && venue) {
      if (sport && venue.sportPricing && venue.sportPricing[sport]) {
        return venue.sportPricing[sport];
      }
      return venue.pricePerHour || 0;
    }
    return 0;
  };

  const pricePerHour = getPricePerHour();
  const subtotal = durationHours * pricePerHour;
  const serviceFee = Math.round(subtotal * 0.02);
  const taxes = Math.round(subtotal * 0.05);
  const total = Math.max(0, subtotal + serviceFee + taxes - discount);

  // Booking details
  const bookingDetails: CheckoutDetailItem[] = [
    {
      label: "Date",
      value: date ? formatDate(date) : "Not selected",
    },
    {
      label: "Time",
      value:
        startTime && endTime
          ? `${formatTime(startTime)} - ${formatTime(endTime)}`
          : "Not selected",
    },
    {
      label: "Sport",
      value: sport || "Not selected",
    },
    {
      label: "Participant",
      value: selectedDependent ? selectedDependent.name : user?.name || "Me",
      hint: selectedDependent ? "Booking for dependent" : "Booking for self",
    },
    {
      label: "Duration",
      value: durationHours ? `${durationHours} hour(s)` : "-",
      hint: durationHours ? `${durationHours} x hourly rate` : undefined,
    },
    ...(type === "coach"
      ? [
          {
            label: "Coach",
            value: coach ? coach.sports?.[0] + " Coach" : "Loading...",
          },
        ]
      : [
          {
            label: "Venue",
            value: venue?.name || "Loading...",
          },
        ]),
  ];

  // Summary items
  const summaryItems: CheckoutSummaryItem[] = [
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
      label: "Service fee",
      value: formatCurrency(serviceFee),
      hint: "Platform support and protection",
    },
    {
      label: "Taxes",
      value: formatCurrency(taxes),
      hint: "Estimated",
    },
  ];

  if (discount > 0) {
    summaryItems.push({
      label: "Promo discount",
      value: `-${formatCurrency(discount)}`,
      hint: promoCode ? promoCode.toUpperCase() : undefined,
      strong: true,
    });
  }

  const hasRequiredDetails = Boolean(date && startTime && endTime && sport);
  const hasValidDuration = durationMinutes > 0;
  const isDetailsReady = type === "coach" ? Boolean(coach) : Boolean(venue);

  const steps = [
    {
      id: 1,
      label: "Step 1",
      title: "Review your booking",
      description:
        type === "coach"
          ? "Confirm coach and schedule details."
          : "Confirm venue and schedule details.",
    },
    {
      id: 2,
      label: "Step 2",
      title: "Choose payment",
      description: "Select a method and apply promos.",
    },
    {
      id: 3,
      label: "Step 3",
      title: "Confirm & pay",
      description: "Verify summary and complete payment.",
    },
  ];

  const currentStepInfo = steps.find((step) => step.id === currentStep);

  const handleNextStep = () => {
    if (!hasRequiredDetails) {
      toast.error("Missing booking details. Please edit your booking first.");
      return;
    }
    if (!hasValidDuration) {
      toast.error("End time must be after start time.");
      return;
    }
    setCurrentStep((prev) => Math.min(3, prev + 1));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleApplyPromo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPromoMessage(null);

    if (!promoCode.trim()) {
      setDiscount(0);
      setPromoMessage("Enter a promo code to apply.");
      return;
    }

    if (promoCode.trim().toUpperCase() === "PLAY10") {
      const promoDiscount = Math.round(subtotal * 0.1);
      setDiscount(promoDiscount);
      setPromoMessage("Promo applied: 10% off.");
      return;
    }

    setDiscount(0);
    setPromoMessage("This promo code is not valid.");
  };

  const handleCheckout = async () => {
    if (user && user.role !== "PLAYER") {
      toast.error("Only player accounts can create bookings.");
      return;
    }

    if (!hasRequiredDetails) {
      toast.error("Missing booking details. Please edit your booking first.");
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

    setIsSubmitting(true);

    try {
      const bookingDate = new Date(date).toISOString();
      let response;

      if (type === "coach") {
        // Get player location for coach booking
        const playerLocation = await new Promise<{
          type: "Point";
          coordinates: [number, number];
        }>((resolve, reject) => {
          const timeout = setTimeout(
            () =>
              reject(
                new Error(
                  "Location request timed out. Coach is out of your service area or location is required.",
                ),
              ),
            10000,
          );

          navigator.geolocation.getCurrentPosition(
            (position) => {
              clearTimeout(timeout);
              resolve({
                type: "Point",
                coordinates: [
                  position.coords.longitude,
                  position.coords.latitude,
                ],
              });
            },
            (error) => {
              clearTimeout(timeout);
              reject(error);
            },
            { enableHighAccuracy: true },
          );
        });

        response = await bookingApi.initiateBooking({
          coachId,
          sport,
          date: bookingDate,
          startTime,
          endTime,
          playerLocation,
          dependentId: selectedDependentId || undefined,
        });
      } else {
        // Venue booking doesn't need player location
        response = await bookingApi.initiateBooking({
          venueId,
          sport,
          date: bookingDate,
          startTime,
          endTime,
          dependentId: selectedDependentId || undefined,
        });
      }

      const bookingId = response.booking?.id;
      if (!bookingId) {
        throw new Error("Booking could not be created");
      }

      await bookingApi.confirmMockPaymentSuccess(bookingId);

      router.push(
        `/payment?status=success&bookingId=${encodeURIComponent(bookingId)}&type=${type}&mock=true`,
      );
    } catch (submitError: unknown) {
      console.error("Checkout failed:", submitError);
      const errorMessage =
        submitError instanceof Error
          ? submitError.message
          : "Unable to complete checkout. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl bg-white py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-power-orange" />
      </div>
    );
  }

  if (!isDetailsReady) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center">
        <p className="text-slate-600">
          {type === "coach" ? "Coach" : "Venue"} not found.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(type === "coach" ? "/coaches" : "/venues")}
        >
          Browse {type === "coach" ? "coaches" : "venues"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Checkout"
        title={
          type === "coach"
            ? "Complete your coach booking"
            : "Complete your venue booking"
        }
        subtitle="Review your booking details, pick a payment method, and confirm your slot."
        action={
          <div className="flex flex-wrap gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrevStep}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => router.back()}>
              Edit booking
            </Button>
          </div>
        }
      />

      <Card className="bg-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Step {currentStep} of {steps.length}
            </p>
            <p className="text-lg font-bold text-slate-900">
              {currentStepInfo?.title}
            </p>
            <p className="text-sm text-slate-500">
              {currentStepInfo?.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {steps.map((step, index) => {
              const isActive = currentStep === step.id;
              const isComplete = currentStep > step.id;
              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${
                      isComplete
                        ? "border-power-orange bg-power-orange text-white"
                        : isActive
                          ? "border-power-orange text-power-orange"
                          : "border-slate-200 text-slate-400"
                    }`}
                  >
                    {step.id}
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    {step.label}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="h-px w-8 bg-slate-200" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <CheckoutShell
        aside={
          <div className="space-y-6">
            <CheckoutSummary
              items={summaryItems}
              totalValue={formatCurrency(total)}
              note={
                type === "venue"
                  ? "Your slot is reserved for 10 minutes after confirmation."
                  : "Booking confirmed after location verification."
              }
              cta={
                <div className="flex flex-col gap-2">
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
                    {currentStep === 1 && "Step 2: Payment"}
                    {currentStep === 2 && "Step 3: Confirm"}
                    {currentStep === 3 && "Pay and confirm"}
                  </Button>
                </div>
              }
            />

            <Card className="bg-white">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 shrink-0 text-green-600">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Protected checkout
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Payments are encrypted end-to-end. You can reschedule from
                    your dashboard if needed.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        }
      >
        {currentStep === 1 && (
          <>
            {type === "venue" && venue && (
              <CheckoutSection
                title="Venue overview"
                description="Confirm the venue and location before you pay."
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-24 w-full overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-40">
                    {venue.images?.[0] ? (
                      <img
                        src={venue.images[0]}
                        alt={venue.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                        No image available
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-slate-900">
                      {venue.name}
                    </p>
                    {venue.address && (
                      <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={16} />
                        {venue.address}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {venue.sports.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-power-orange/10 px-3 py-1 text-xs font-semibold text-power-orange"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CheckoutSection>
            )}

            {type === "coach" && coach && (
              <CheckoutSection
                title="Coach overview"
                description="Confirm the coach and location before you pay."
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-24 w-full overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-40 flex items-center justify-center">
                    <span className="text-2xl text-slate-400">🏆</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-slate-900">
                      {coach.sports?.[0] || "Coach"} Coach
                    </p>
                    {coach.serviceMode && (
                      <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={16} />
                        {coach.serviceMode === "FREELANCE"
                          ? "Freelance"
                          : coach.serviceMode === "OWN_VENUE"
                            ? "Own Venue"
                            : "Hybrid"}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {coach.sports.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-power-orange/10 px-3 py-1 text-xs font-semibold text-power-orange"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CheckoutSection>
            )}

            <CheckoutSection
              title="Booking details"
              description="Verify your schedule and attendee details."
              action={
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Calendar size={14} />
                  {date ? formatDate(date) : "No date"}
                </span>
              }
            >
              {user?.dependents && user.dependents.length > 0 && (
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-900">
                    Who is attending?
                  </label>
                  <select
                    value={selectedDependentId}
                    onChange={(event) =>
                      setSelectedDependentId(event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/40"
                  >
                    <option value="">Me ({user.name})</option>
                    {user.dependents.map((dependent) => (
                      <option key={dependent._id} value={dependent._id || ""}>
                        {dependent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <CheckoutDetailList items={bookingDetails} />
              <div className="mt-4 flex flex-wrap gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <span className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  Arrival buffer: 10 minutes before slot start.
                </span>
              </div>
            </CheckoutSection>
          </>
        )}

        {currentStep === 2 && (
          <>
            <CheckoutSection
              title="Payment method"
              description="Choose how you want to pay for this booking."
            >
              <PaymentMethodSelector
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={paymentOptions}
              />
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Selected:{" "}
                {
                  paymentOptions.find((option) => option.id === paymentMethod)
                    ?.label
                }
              </div>
            </CheckoutSection>

            <CheckoutSection
              title="Promo code"
              description="Apply a promo to save on your booking."
            >
              <form
                onSubmit={handleApplyPromo}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <div className="relative flex-1">
                  <TicketPercent
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={promoCode}
                    onChange={(event) => setPromoCode(event.target.value)}
                    placeholder="Enter code (try PLAY10)"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/40"
                  />
                </div>
                <Button type="submit" variant="outline" className="sm:w-40">
                  Apply
                </Button>
              </form>
              {promoMessage && (
                <p className="mt-2 text-xs text-slate-500">{promoMessage}</p>
              )}
            </CheckoutSection>
          </>
        )}

        {currentStep === 3 && (
          <CheckoutSection
            title="Confirm booking"
            description="Review your summary before confirming payment."
          >
            <CheckoutDetailList items={bookingDetails} />
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Payment method:{" "}
              {
                paymentOptions.find((option) => option.id === paymentMethod)
                  ?.label
              }
            </div>
          </CheckoutSection>
        )}

        {!hasRequiredDetails && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Missing booking details. Please go back and select a date, time, and
            sport.
          </div>
        )}

        {hasRequiredDetails && !hasValidDuration && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            End time must be after start time.
          </div>
        )}
      </CheckoutShell>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={<div className="text-center py-12">Loading checkout...</div>}
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
