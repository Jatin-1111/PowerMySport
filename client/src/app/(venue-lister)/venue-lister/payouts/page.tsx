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
      if (!res.success || !res.data?.payoutMethod) {
        throw new Error(res.message || "Failed to save payout method");
      }
      return res.data.payoutMethod;
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
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/20 p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-power-orange/15 shrink-0">
            <BadgeIndianRupee size={24} className="text-power-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Payout Settings</h1>
            <p className="mt-1 text-sm text-slate-400">
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

      <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-xs text-blue-300">
        <Info size={14} className="mt-0.5 shrink-0" />
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
    <div className="rounded-xl border border-white/8 bg-slate-900/60 p-4 space-y-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-power-orange/10">
        <Icon size={17} className="text-power-orange" />
      </div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}
