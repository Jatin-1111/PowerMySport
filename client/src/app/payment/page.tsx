"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "pending";
  const isMockPayment = searchParams.get("mock") === "true";

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
              <Button variant="outline" onClick={() => router.push("/venues")}>
                Browse venues
              </Button>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
