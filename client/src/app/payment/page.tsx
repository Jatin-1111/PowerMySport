"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { getCommunityAppUrl } from "@/lib/community/url";
import { CommunityInsightsCard } from "@/modules/community/components/CommunityInsightsCard";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { bookingApi } from "@/modules/booking/services/booking";
import { Booking } from "@/types";

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "pending";
  const bookingId = searchParams.get("bookingId") || "";
  const type = searchParams.get("type") || "venue";
  const isMockPayment = searchParams.get("mock") === "true";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(!!bookingId);
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
  }, [bookingId]);

  const isSuccess = status === "success";
  const isCancel = status === "cancel";

  const title = isSuccess
    ? "Payment successful"
    : isCancel
      ? "Payment canceled"
      : "Processing payment";

  const description = isSuccess
    ? isMockPayment
      ? "Mock payment completed successfully. Your booking is confirmed."
      : booking?.bookingType === "GROUP" && booking?.paymentType === "SPLIT"
        ? "Your payment share is confirmed. We'll notify you once all participants complete their payments."
        : "Thanks! Your payment is confirmed. We will update your booking shortly."
    : isCancel
      ? "No charge was made. You can try again whenever you are ready."
      : "We are confirming your payment. You can safely leave this page.";

  const icon = isSuccess ? (
    <CheckCircle className="text-green-500" size={44} />
  ) : isCancel ? (
    <XCircle className="text-red-500" size={44} />
  ) : (
    <Clock className="text-power-orange" size={44} />
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f5f8ff_48%,#fff8ee_100%)] flex flex-col">
      <Navigation sticky />
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
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      Group Booking
                    </span>
                    {booking.paymentType === "SPLIT" && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
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
                          .filter((p) => p.userType === "PLAYER")
                          .map((payment, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="text-slate-700">
                                {payment.userId === booking.userId
                                  ? "Your share"
                                  : "Friend's share"}
                              </span>
                              <span className="font-semibold text-slate-900">
                                ₹{payment.amount}
                              </span>
                            </div>
                          ))}
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
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-left text-xs text-blue-800">
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
