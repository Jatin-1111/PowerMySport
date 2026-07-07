"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { getCommunityAppUrl } from "@/lib/community/url";
import { toast } from "@/lib/toast";
import { authApi } from "@/modules/auth/services/auth";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import { CommunityInsightsCard } from "@/modules/community/components/CommunityInsightsCard";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Booking, CoachSubscriptionPackage } from "@/types";
import { formatCurrency } from "@/utils/format";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "pending";
  const bookingId = searchParams.get("bookingId") || "";
  const merchantOrderId = searchParams.get("merchantOrderId") || "";
  const coachId = searchParams.get("coachId") || "";
  const packageId = searchParams.get("packageId") || "";
  const type = searchParams.get("type") || "venue";
  const isSubscriptionPayment = type === "subscription";
  const isMockPayment =
    searchParams.get("mode") === "mock" ||
    searchParams.get("mock") === "true" ||
    searchParams.get("mockPayment") === "true";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [coach, setCoach] = useState<any | null>(null);
  const [subscriptionPackage, setSubscriptionPackage] =
    useState<CoachSubscriptionPackage | null>(null);
  const [loading, setLoading] = useState(!!bookingId || isSubscriptionPayment);
  const [resolvedStatus, setResolvedStatus] = useState(status);
  const communityUrl = getCommunityAppUrl({
    path: "q",
    searchParams: {
      q:
        `${booking?.sport || ""} ${type === "coach" ? "coach" : "venue"}`.trim() ||
        undefined,
      sport: booking?.sport || undefined,
    },
  });

  useEffect(() => {
    const loadBooking = async () => {
      if (isSubscriptionPayment) {
        if (!coachId || !packageId) {
          setLoading(false);
          return;
        }

        try {
          const [coachResponse, packagesResponse, profileResponse] =
            await Promise.all([
              coachApi.getCoachById(coachId),
              coachApi.getCoachPackages(coachId),
              authApi.getProfile().catch(() => null),
            ]);

          if (coachResponse.success && coachResponse.data) {
            setCoach(coachResponse.data);
          }

          if (packagesResponse.success && packagesResponse.data) {
            const selectedPackage = packagesResponse.data.packages.find(
              (item) => (item._id || item.id) === packageId,
            );
            setSubscriptionPackage(selectedPackage || null);
          }

          if (profileResponse?.success && profileResponse.data) {
            if (
              profileResponse.data.role !== "Player" &&
              profileResponse.data.role !== "Parent"
            ) {
              toast.error("Only player accounts can purchase subscriptions.");
              router.replace("/dashboard");
              return;
            }
          }
        } catch (error) {
          console.error("Failed to load subscription details:", error);
          toast.error("Unable to load subscription details");
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!bookingId) return;
      try {
        const response = await bookingApi.getBooking(bookingId);
        if (response.success && response.data) {
          setBooking(response.data);
        }
      } catch (error) {
        console.error("Failed to load booking details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [bookingId, coachId, isSubscriptionPayment, packageId, router]);

  // Compute derived state early, before any effects that use it
  const isSuccess = resolvedStatus === "success";
  const isCancel = resolvedStatus === "cancel";

  useEffect(() => {
    setResolvedStatus(status);
  }, [status]);

  useEffect(() => {
    if (status !== "pending" || !merchantOrderId) {
      return;
    }

    if (isSubscriptionPayment) {
      return;
    }

    let isActive = true;
    let attempts = 0;
    const maxAttempts = 12;
    const pollIntervalMs = 5000;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const verifyPayment = async () => {
      try {
        attempts += 1;
        const result =
          await bookingApi.verifyPhonePeOrderStatus(merchantOrderId);
        if (!isActive) return;

        if (result?.state === "COMPLETED") {
          setResolvedStatus("success");
          if (pollTimer) clearInterval(pollTimer);
        } else if (result?.state === "FAILED") {
          setResolvedStatus("cancel");
          if (pollTimer) clearInterval(pollTimer);
        } else if (attempts >= maxAttempts && pollTimer) {
          clearInterval(pollTimer);
        }
      } catch (error) {
        console.error("Failed to verify PhonePe payment:", error);
        if (attempts >= maxAttempts && pollTimer) {
          clearInterval(pollTimer);
        }
      }
    };

    verifyPayment();
    pollTimer = setInterval(verifyPayment, pollIntervalMs);

    return () => {
      isActive = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [merchantOrderId, status]);

  useEffect(() => {
    if (!isSubscriptionPayment || status !== "pending" || !merchantOrderId) {
      return;
    }

    let isActive = true;
    let attempts = 0;
    const maxAttempts = 12;
    const pollIntervalMs = 5000;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const verifyPayment = async () => {
      try {
        attempts += 1;
        const result =
          await coachApi.verifySubscriptionPaymentStatus(merchantOrderId);
        if (!isActive) return;

        if (result?.state === "COMPLETED") {
          setResolvedStatus("success");
          if (pollTimer) clearInterval(pollTimer);
        } else if (result?.state === "FAILED") {
          setResolvedStatus("cancel");
          if (pollTimer) clearInterval(pollTimer);
        } else if (attempts >= maxAttempts && pollTimer) {
          clearInterval(pollTimer);
        }
      } catch (error) {
        console.error("Failed to verify subscription payment:", error);
        if (attempts >= maxAttempts && pollTimer) {
          clearInterval(pollTimer);
        }
      }
    };

    verifyPayment();
    pollTimer = setInterval(verifyPayment, pollIntervalMs);

    return () => {
      isActive = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [merchantOrderId, status, isSubscriptionPayment]);

  const title = isSuccess
    ? "Payment successful"
    : isCancel
      ? "Payment canceled"
      : "Processing payment";

  const description = isSuccess
    ? booking?.bookingType === "GROUP" && booking?.paymentType === "SPLIT"
      ? "Your payment share is confirmed. We'll notify you once all participants complete their payments."
      : "Thanks! Your payment is confirmed. We will update your booking shortly."
    : isCancel
      ? "No charge was made. You can try again whenever you are ready."
      : "We are confirming your payment. You can safely leave this page.";

  const icon = isSuccess ? (
    <CheckCircle className="text-emerald-600" size={44} />
  ) : isCancel ? (
    <XCircle className="text-red-500" size={44} />
  ) : (
    <Clock className="text-power-orange" size={44} />
  );

  const subscriptionCharges = (() => {
    const basePaise = Math.round(subscriptionPackage?.price || 0);
    const platformFeeRate = Number(
      process.env.NEXT_PUBLIC_SUBSCRIPTION_PLATFORM_FEE_RATE ??
        process.env.NEXT_PUBLIC_SERVICE_FEE_RATE ??
        0,
    );
    const taxRate = Number(
      process.env.NEXT_PUBLIC_SUBSCRIPTION_TAX_RATE ??
        process.env.NEXT_PUBLIC_TAX_RATE ??
        0.05,
    );
    const safePlatformFeeRate = Number.isFinite(platformFeeRate)
      ? Math.max(0, platformFeeRate)
      : 0;
    const safeTaxRate = Number.isFinite(taxRate) ? Math.max(0, taxRate) : 0;
    const platformFeePaise = Math.round(basePaise * safePlatformFeeRate);
    const taxPaise =
      platformFeePaise > 0 ? Math.round(platformFeePaise * safeTaxRate) : 0;

    return {
      basePaise,
      platformFeePaise,
      taxPaise,
      totalPaise: basePaise + platformFeePaise + taxPaise,
    };
  })();

  if (isSubscriptionPayment) {
    const coachName =
      coach && typeof coach.userId === "object" && coach.userId?.name
        ? coach.userId.name
        : coach?.sports?.[0]
          ? `${coach.sports[0]} Coach`
          : "Coach";

    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f5f8ff_48%,#fff8ee_100%)] flex flex-col">
        <Navigation sticky />
        <div className="h-16" aria-hidden />
        <main className="flex-1 py-10">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
            <Card className="space-y-5 rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
              <div className="flex justify-center">{icon}</div>
              <div className="text-center">
                <h2 className="font-title text-2xl font-semibold text-slate-900">
                  {isSuccess
                    ? "Payment successful"
                    : isCancel
                      ? "Payment canceled"
                      : "Processing payment"}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {isSuccess
                    ? "Payment is confirmed. Subscription activation follows webhook verification and may take a short moment."
                    : isCancel
                      ? "No charge was made. You can try again whenever you are ready."
                      : "We are confirming your payment. You can safely leave this page."}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Coach
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {coachName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Package
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {subscriptionPackage?.name || "Selected package"}
                  </p>
                  <p className="text-sm text-slate-600">
                    {subscriptionPackage?.description ||
                      "Your selected subscription package."}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
                  <span className="text-slate-600">Plan amount</span>
                  <span className="font-semibold text-slate-900">
                    {subscriptionPackage
                      ? formatCurrency(subscriptionCharges.basePaise / 100)
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
                  <span className="text-slate-600">Platform fee</span>
                  <span className="font-semibold text-slate-900">
                    {subscriptionPackage
                      ? formatCurrency(
                          subscriptionCharges.platformFeePaise / 100,
                        )
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
                  <span className="text-slate-600">Taxes</span>
                  <span className="font-semibold text-slate-900">
                    {subscriptionPackage
                      ? formatCurrency(subscriptionCharges.taxPaise / 100)
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm">
                  <span className="text-slate-600">Total charged</span>
                  <span className="font-semibold text-slate-900">
                    {subscriptionPackage
                      ? formatCurrency(subscriptionCharges.totalPaise / 100)
                      : "-"}
                  </span>
                </div>
                {isMockPayment && (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                    Mock payment mode
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => router.push("/dashboard")}
                >
                  Go to dashboard
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push(`/coaches/${coachId}`)}
                >
                  Back to coach
                </Button>
              </div>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f5f8ff_48%,#fff8ee_100%)] flex flex-col">
      <Navigation sticky />
      <div className="h-16" aria-hidden />
      <main className="flex-1 py-10">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/95 p-6 text-center shadow-sm backdrop-blur-sm sm:p-8">
            <div className="flex justify-center">{icon}</div>
            <div>
              <h2 className="font-title text-2xl font-semibold text-slate-900">
                {title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>

            {/* Booking Details */}
            {isSuccess && booking && (
              <div className="bg-slate-50 rounded-lg p-4 text-left space-y-3 border border-slate-200">
                {/* Booking Type Badge */}
                {booking.bookingType === "GROUP" && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      Group Booking
                    </span>
                    {booking.paymentType === "SPLIT" && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Split Payment
                      </span>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">
                    {type === "coach" ? "Coach" : "Venue"}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {type === "coach"
                      ? booking.coach?.sports?.[0]
                        ? `${booking.coach.sports[0]} Coach`
                        : "Coach"
                      : booking.venue?.name || "Venue"}
                  </p>
                </div>
                <div className="border-t border-slate-200"></div>
                {booking.date && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold">
                      Date
                    </p>
                    <p className="text-sm text-slate-900 mt-1">
                      {new Date(booking.date).toLocaleDateString("en-IN", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {booking.startTime && booking.endTime && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold">
                      Time
                    </p>
                    <p className="text-sm text-slate-900 mt-1">
                      {booking.startTime} - {booking.endTime}
                    </p>
                  </div>
                )}
                {booking.sport && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-semibold">
                      Sport
                    </p>
                    <p className="text-sm text-slate-900 mt-1">
                      {booking.sport}
                    </p>
                  </div>
                )}
                {/* Group Booking Participants */}
                {booking.bookingType === "GROUP" && booking.participants && (
                  <div className="border-t border-slate-200">
                    <p className="text-xs text-slate-500 uppercase font-semibold mb-2">
                      Participants (
                      {booking.participants.filter(
                        (p) => p.status === "ACCEPTED",
                      ).length + 1}
                      )
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 rounded-full bg-power-orange text-white flex items-center justify-center text-xs font-semibold">
                          O
                        </div>
                        <span className="text-slate-900 font-medium">
                          You (Organizer)
                        </span>
                      </div>
                      {booking.participants
                        .filter((p) => p.status === "ACCEPTED")
                        .map((participant, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm"
                          >
                            <div className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-semibold">
                              {participant.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-slate-700">
                              {participant.name}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                {/* Payment Split Details */}
                {booking.bookingType === "GROUP" &&
                  booking.paymentType === "SPLIT" &&
                  booking.payments && (
                    <div className="border-t border-slate-200">
                      <p className="text-xs text-slate-500 uppercase font-semibold mb-2">
                        Payment Split
                      </p>
                      <div className="space-y-1.5">
                        {booking.payments
                          .filter((p) => p.userType === "Player")
                          .map((payment, idx) => {
                            let nameStr = "Friend's share";
                            if (payment.userId === booking.userId) {
                              nameStr = "Your share";
                            } else if (booking.participants) {
                              const participant = booking.participants.find(
                                (p) => p.userId === payment.userId,
                              );
                              if (participant) {
                                nameStr = `${participant.name}'s share`;
                              }
                            }

                            return (
                              <div
                                key={idx}
                                className="flex justify-between items-center text-sm"
                              >
                                <span className="text-slate-700">
                                  {nameStr}
                                </span>
                                <span className="font-semibold text-slate-900">
                                  ₹{payment.amount}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                {booking.totalAmount && (
                  <div className="border-t border-slate-200">
                    <p className="text-xs text-slate-500 uppercase font-semibold">
                      {booking.bookingType === "GROUP" &&
                      booking.paymentType === "SPLIT"
                        ? "Total Booking Amount"
                        : "Amount Paid"}
                    </p>
                    <p className="text-lg font-bold text-power-orange mt-1">
                      ₹{booking.totalAmount}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Group Booking Info */}
            {isSuccess && booking?.bookingType === "GROUP" && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-left text-xs text-blue-800">
                {booking.paymentType === "SPLIT" ? (
                  <div className="space-y-1">
                    <p className="font-semibold">
                      ℹ️ Group Booking - Split Payment
                    </p>
                    <p>
                      Your payment share has been confirmed. The booking will be
                      finalized once all participants complete their payments.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold">
                      ℹ️ Group Booking - Single Payment
                    </p>
                    <p>
                      You've paid the full amount for the group booking. All
                      invited participants have been notified.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isMockPayment && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs text-slate-600">
                <p>
                  Mode: <span className="font-semibold">Mock payment</span>
                </p>
              </div>
            )}

            {isSuccess && (
              <CommunityInsightsCard
                title="Share or ask in community"
                description="Get tips, find partners, and discuss your upcoming session with local players and coaches."
                q={`${booking?.sport || ""} ${type === "coach" ? "coach" : "venue"}`}
                sport={booking?.sport || ""}
                ctaUrl={communityUrl}
                enabled
              />
            )}
            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                onClick={() => router.push("/dashboard/my-bookings")}
              >
                View my bookings
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  router.push(type === "coach" ? "/coaches" : "/venues")
                }
              >
                Browse {type === "coach" ? "coaches" : "venues"}
              </Button>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={<div className="text-center py-12">Loading payment...</div>}
    >
      <PaymentPageContent />
    </Suspense>
  );
}
