"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { bookingApi } from "@/modules/booking/services/booking";
import { Booking } from "@/types";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "pending";
  const bookingId = searchParams.get("bookingId") || "";
  const type = searchParams.get("type") || "venue";
  const isMockPayment = searchParams.get("mock") === "true";

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(!!bookingId);

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navigation variant="dark" sticky />
      <main className="flex-1 py-10">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="bg-white text-center space-y-4">
            <div className="flex justify-center">{icon}</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>

            {/* Booking Details */}
            {isSuccess && booking && (
              <div className="bg-slate-50 rounded-lg p-4 text-left space-y-3 border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">
                    {type === "coach" ? "Coach" : "Venue"}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {type === "coach"
                      ? booking.coach?.name || "Coach"
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
                {booking.totalAmount && (
                  <div className="border-t border-slate-200">
                    <p className="text-xs text-slate-500 uppercase font-semibold">
                      Amount Paid
                    </p>
                    <p className="text-lg font-bold text-power-orange mt-1">
                      ₹{booking.totalAmount}
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
