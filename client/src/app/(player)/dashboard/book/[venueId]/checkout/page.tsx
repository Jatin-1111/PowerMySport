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
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
import { venueApi } from "@/modules/venue/services/venue";
import { Venue } from "@/types";
import { formatCurrency, formatDate, formatTime } from "@/utils/format";

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

export default function VenueCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const venueId = params.venueId as string;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const date = searchParams.get("date") || "";
  const startTime = searchParams.get("startTime") || "";
  const endTime = searchParams.get("endTime") || "";
  const sport = searchParams.get("sport") || "";
  const dependentId = searchParams.get("dependentId") || "";

  useEffect(() => {
    const loadVenue = async () => {
      try {
        const response = await venueApi.getVenue(venueId);
        if (response.success && response.data) {
          setVenue(response.data);
        } else {
          setError("Unable to load venue details");
        }
      } catch (loadError) {
        console.error("Failed to load venue:", loadError);
        setError("Unable to load venue details");
      } finally {
        setLoading(false);
      }
    };

    loadVenue();
  }, [venueId]);

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

  const pricePerHour = useMemo(() => {
    if (!venue) return 0;
    if (
      sport &&
      venue.sportPricing &&
      venue.sportPricing[sport] !== undefined
    ) {
      return venue.sportPricing[sport];
    }
    return venue.pricePerHour;
  }, [venue, sport]);

  const subtotal = durationHours * pricePerHour;
  const serviceFee = Math.round(subtotal * 0.02);
  const taxes = Math.round(subtotal * 0.05);
  const total = Math.max(0, subtotal + serviceFee + taxes - discount);

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
      label: "Duration",
      value: durationHours ? `${durationHours} hour(s)` : "-",
      hint: durationHours ? `${durationHours} x hourly rate` : undefined,
    },
  ];

  const summaryItems: CheckoutSummaryItem[] = [
    {
      label: "Venue rate",
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

  const steps = [
    {
      id: 1,
      label: "Step 1",
      title: "Review your booking",
      description: "Confirm venue and schedule details.",
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
    setError(null);
    if (!hasRequiredDetails) {
      setError("Missing booking details. Please edit your booking first.");
      return;
    }
    if (!hasValidDuration) {
      setError("End time must be after start time.");
      return;
    }
    setCurrentStep((prev) => Math.min(3, prev + 1));
  };

  const handlePrevStep = () => {
    setError(null);
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
    setError(null);

    if (!hasRequiredDetails) {
      setError("Missing booking details. Please edit your booking first.");
      return;
    }

    if (!hasValidDuration) {
      setError("End time must be after start time.");
      return;
    }

    if (!venue) {
      setError("Venue details are not available.");
      return;
    }

    setIsSubmitting(true);

    try {
      const bookingDate = new Date(date).toISOString();

      const response = await bookingApi.initiateBooking({
        venueId,
        sport,
        date: bookingDate,
        startTime,
        endTime,
        dependentId: dependentId || undefined,
      });

      if (!response.checkoutUrl) {
        throw new Error("Payment session could not be created");
      }

      window.location.href = response.checkoutUrl;
    } catch (submitError: any) {
      console.error("Checkout failed:", submitError);
      setError(
        submitError.response?.data?.message ||
          "Unable to start checkout. Please try again.",
      );
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

  if (!venue) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center">
        <p className="text-slate-600">Venue not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/venues")}
        >
          Browse venues
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlayerPageHeader
        badge="Checkout"
        title="Complete your venue booking"
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
              note="Your slot is reserved for 10 minutes after confirmation."
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
                <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-turf-green/10 text-turf-green">
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
                <p className="text-lg font-bold text-slate-900">{venue.name}</p>
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

        {currentStep === 1 && (
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
            <CheckoutDetailList items={bookingDetails} />
            <div className="mt-4 flex flex-wrap gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                Arrival buffer: 10 minutes before slot start.
              </span>
            </div>
          </CheckoutSection>
        )}

        {currentStep === 2 && (
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
        )}

        {currentStep === 2 && (
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
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
