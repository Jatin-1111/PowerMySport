"use client";

import { toast } from "@/lib/toast";
import { coachApi } from "@/modules/coach/services/coach";
import { PlayerPageHeader } from "@/modules/player/components/PlayerPageHeader";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Coach, CoachSubscriptionPackage } from "@/types";
import { formatCurrency } from "@/utils/format";
import {
  ArrowLeft,
  CheckCircle2,
  CalendarRange,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

const getFrequencyLabel = (frequency: string) => {
  switch (frequency) {
    case "YEARLY":
      return "Yearly";
    case "QUARTERLY":
      return "Quarterly";
    default:
      return "Monthly";
  }
};

const getFrequencyCadence = (frequency: string) => {
  switch (frequency) {
    case "YEARLY":
      return "/ year";
    case "QUARTERLY":
      return "/ 3 months";
    default:
      return "/ month";
  }
};

function SubscriptionCheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coachId = searchParams.get("coachId") || "";
  const packageId = searchParams.get("packageId") || "";
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [subscriptionPackage, setSubscriptionPackage] =
    useState<CoachSubscriptionPackage | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!coachId || !packageId) {
        setLoading(false);
        return;
      }

      try {
        const [coachResponse, packageResponse] = await Promise.all([
          coachApi.getCoachById(coachId),
          coachApi.getCoachPackages(coachId),
        ]);

        if (coachResponse.success && coachResponse.data) {
          setCoach(coachResponse.data);
        }

        if (packageResponse.success && packageResponse.data) {
          const selected = packageResponse.data.packages.find(
            (pkg) => (pkg._id || pkg.id) === packageId,
          );
          setSubscriptionPackage(selected || null);
        }
      } catch (error) {
        console.error("Failed to load subscription checkout data:", error);
        toast.error("Unable to load subscription details.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [coachId, packageId]);

  const frequencyLabel = useMemo(
    () => getFrequencyLabel(subscriptionPackage?.frequency || "MONTHLY"),
    [subscriptionPackage?.frequency],
  );

  const priceBreakdown = useMemo(() => {
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
    const totalPaise = basePaise + platformFeePaise + taxPaise;

    return {
      basePaise,
      platformFeePaise,
      taxPaise,
      totalPaise,
      isZeroCommission: platformFeePaise === 0,
    };
  }, [subscriptionPackage?.price]);

  const handlePay = async () => {
    if (!coachId || !packageId || !subscriptionPackage) {
      toast.error("Subscription package not found.");
      return;
    }

    setSubmitting(true);
    try {
      const isMockPayment = process.env.NODE_ENV !== "production";

      if (isMockPayment) {
        const paymentUrl = new URL("/payment", window.location.origin);
        paymentUrl.searchParams.set("status", "success");
        paymentUrl.searchParams.set("type", "subscription");
        paymentUrl.searchParams.set("coachId", coachId);
        paymentUrl.searchParams.set("packageId", packageId);
        paymentUrl.searchParams.set("mode", "mock");
        window.location.assign(paymentUrl.toString());
        return;
      }

      const response = await coachApi.initiateSubscriptionPayment({
        coachId,
        packageId,
      });

      if (!response.redirectUrl) {
        throw new Error("Unable to start payment.");
      }

      window.location.assign(response.redirectUrl);
    } catch (error) {
      console.error("Failed to initiate subscription payment:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to start subscription payment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center">Loading subscription...</div>;
  }

  if (!coach || !subscriptionPackage) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Subscription Checkout" },
          ]}
        />
        <Card className="rounded-3xl border border-slate-200/70 bg-white/95 p-6 text-center">
          <p className="text-slate-600">
            We could not find this subscription package.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => router.push("/coaches")}
          >
            Browse coaches
          </Button>
        </Card>
      </div>
    );
  }

  const coachUserName =
    typeof coach.userId === "object" && coach.userId?.name
      ? coach.userId.name
      : "";
  const coachDisplayName =
    coachUserName || `${coach.sports?.[0] || "Professional"} Coach`;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: coachDisplayName, href: `/coaches/${coachId}` },
          { label: "Subscription Checkout" },
        ]}
      />

      <PlayerPageHeader
        badge="Subscription"
        title="Complete your subscription"
        subtitle="Review the package details, pay securely, and your access will start immediately after payment is confirmed."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/coaches/${coachId}`}>
              <Button variant="outline">Back to coach</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Package summary
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {subscriptionPackage.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {subscriptionPackage.description ||
                  "A simple coaching package with clear benefits and fixed billing cadence."}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {frequencyLabel}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Price
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {formatCurrency(subscriptionPackage.price / 100)}
              </p>
              <p className="text-xs text-slate-500">
                {frequencyLabel}{" "}
                {getFrequencyCadence(subscriptionPackage.frequency)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Coach
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {coachDisplayName}
              </p>
              <p className="text-xs text-slate-500">
                {coach.sports?.slice(0, 2).join(", ") || "Coaching"}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
            <div className="flex items-center justify-between text-slate-700">
              <span>Plan amount</span>
              <span>{formatCurrency(priceBreakdown.basePaise / 100)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Platform fee</span>
              <span>
                {formatCurrency(priceBreakdown.platformFeePaise / 100)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>Taxes on platform fee</span>
              <span>{formatCurrency(priceBreakdown.taxPaise / 100)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>Total payable (PhonePe)</span>
              <span>{formatCurrency(priceBreakdown.totalPaise / 100)}</span>
            </div>
            {priceBreakdown.isZeroCommission ? (
              <p className="text-xs text-slate-500">
                Platform fee currently waived for coach bookings only.
                Subscription pricing may include platform and tax components.
              </p>
            ) : null}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Included</p>
            <div className="mt-3 space-y-2">
              {subscriptionPackage.features.length > 0 ? (
                subscriptionPackage.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <CheckCircle2
                      size={16}
                      className="mt-0.5 shrink-0 text-turf-green"
                    />
                    <span>{feature}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No features listed yet.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
            {typeof subscriptionPackage.maxStudents === "number" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Up to {subscriptionPackage.maxStudents} students
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Flexible student count
              </span>
            )}
            {typeof subscriptionPackage.maxSessions === "number" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                {subscriptionPackage.maxSessions} sessions
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Flexible session count
              </span>
            )}
          </div>
        </Card>

        <Card className="rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-power-orange/10 text-power-orange">
              <Sparkles size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-950">
                Pay and activate
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Your subscription starts once payment is confirmed and will stay
                active until the current billing period ends.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
            <div className="flex gap-3">
              <ShieldCheck size={18} className="mt-0.5 text-turf-green" />
              <p>
                Secure checkout through the same payment flow used elsewhere in
                the app.
              </p>
            </div>
            <div className="flex gap-3">
              <CalendarRange size={18} className="mt-0.5 text-power-orange" />
              <p>
                The plan will remain active until expiry, then move through the
                subscription lifecycle automatically.
              </p>
            </div>
            <div className="flex gap-3">
              <Users size={18} className="mt-0.5 text-sky-600" />
              <p>
                After payment, you can find the active subscription in your
                dashboard.
              </p>
            </div>
          </div>

          <Button
            className="mt-6 w-full bg-turf-green hover:bg-green-700"
            onClick={handlePay}
            loading={submitting}
            disabled={submitting}
            icon={<Zap size={16} />}
          >
            Pay {formatCurrency(priceBreakdown.totalPaise / 100)} and subscribe
          </Button>

          <Link href={`/coaches/${coachId}`}>
            <Button variant="outline" className="mt-3 w-full">
              <ArrowLeft size={16} />
              Back to coach profile
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

export default function SubscriptionCheckoutPage() {
  return (
    <Suspense
      fallback={<div className="py-12 text-center">Loading checkout...</div>}
    >
      <SubscriptionCheckoutContent />
    </Suspense>
  );
}
