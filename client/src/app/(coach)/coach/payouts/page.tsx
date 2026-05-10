"use client";

import { payoutApi } from "@/modules/shared/services/payout";
import { PayoutMethodManager } from "@/modules/shared/components/payout/PayoutMethodManager";
import { IPayoutMethod } from "@/types";
import { useCallback } from "react";
import React from "react";
import {
  BadgeIndianRupee,
  Info,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function CoachPayoutsPage() {
  const handleLoad = useCallback(async (): Promise<IPayoutMethod | null> => {
    const res = await payoutApi.getCoachPayoutMethod();
    return res.data?.payoutMethod ?? null;
  }, []);

  const handleSave = useCallback(
    async (
      payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">,
    ): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertCoachPayoutMethod(payload);
      if (!res.success || !res.data?.payoutMethod) {
        throw new Error(res.message || "Failed to save payout method");
      }
      return res.data.payoutMethod;
    },
    [],
  );

  const handleDelete = useCallback(async () => {
    const res = await payoutApi.deleteCoachPayoutMethod();
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
              Manage how you receive earnings from your coaching sessions. Your
              payout method is used when a booking is completed and funds are
              released.
            </p>
          </div>
        </div>
      </div>

      {/* ── Payout manager ── */}
      <PayoutMethodManager
        ownerType="COACH"
        onLoad={handleLoad}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* ── Info cards ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard
          icon={Zap}
          title="Fast Payouts"
          description="Earnings are released within 2–3 business days after a session is completed."
        />
        <InfoCard
          icon={ShieldCheck}
          title="Secure & Encrypted"
          description="Your banking details are AES-256 encrypted at rest and never shared with third parties."
        />
        <InfoCard
          icon={Info}
          title="One Method"
          description="You can have one active payout method at a time. Update it anytime from this page."
        />
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
