"use client";

import { payoutApi } from "@/modules/shared/services/payout";
import { PayoutMethodManager } from "@/modules/shared/components/payout/PayoutMethodManager";
import { IPayoutMethod } from "@/types";
import { useCallback } from "react";
import React from "react";
import {
  BadgeIndianRupee,
  Building2,
  Info,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function VenuePayoutsPage() {
  const handleLoad = useCallback(async (): Promise<IPayoutMethod | null> => {
    const res = await payoutApi.getVenuePayoutMethod();
    return res.data?.payoutMethod ?? null;
  }, []);

  const handleSave = useCallback(
    async (
      payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
    ): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertVenuePayoutMethod(payload);
      if (!res.success || !res.data?.payoutMethods?.length) {
        throw new Error(res.message || "Failed to save payout method");
      }
      return res.data.payoutMethods[res.data.payoutMethods.length - 1];
    },
    [],
  );

  const handleDelete = useCallback(async () => {
    const res = await payoutApi.deleteVenuePayoutMethod();
    if (!res.success) {
      throw new Error(res.message || "Failed to remove payout method");
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-power-orange/15 shrink-0">
            <BadgeIndianRupee size={24} className="text-power-orange" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Payout Settings
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage how you receive earnings from venue bookings. The payout
              method you set here applies to all your listed venues.
            </p>
          </div>
        </div>
      </div>

      {/* ── Payout manager ── */}
      <PayoutMethodManager
        ownerType="VENUE"
        onLoad={handleLoad}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* ── Info cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard
          icon={Building2}
          title="All Venues Covered"
          description="One payout method covers all venues under your account. Earnings from each venue flow to the same account."
        />
        <InfoCard
          icon={ShieldCheck}
          title="Secure & Encrypted"
          description="Your banking details are AES-256 encrypted at rest and never shared with third parties."
        />
        <InfoCard
          icon={Zap}
          title="Fast Settlements"
          description="Venue booking earnings are settled within 2–3 business days after a confirmed session ends."
        />
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
        <Info
          size={16}
          className="mt-0.5 shrink-0 text-blue-600 flex-shrink-0"
        />
        <p>
          You can update your payout method at any time. Changes will apply to
          future payouts. In-progress payouts will be sent to the previously
          saved method.
        </p>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-power-orange/15 mb-3">
        <Icon size={20} className="text-power-orange" />
      </div>
      <p className="text-base font-bold text-slate-900 mb-2">{title}</p>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
