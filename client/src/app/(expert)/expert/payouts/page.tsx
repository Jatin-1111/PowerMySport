"use client";

import { PayoutMethodManager } from "@/modules/shared/components/payout/PayoutMethodManagerV2";
import { payoutApi } from "@/modules/shared/services/payout";
import { IPayoutMethod } from "@/types";
import { BadgeIndianRupee, Info, ShieldCheck, Zap } from "lucide-react";
import React, { useCallback } from "react";

export default function ExpertPayoutsPage() {
  const handleLoad = useCallback(async (): Promise<IPayoutMethod[]> => {
    const res = await payoutApi.getExpertPayoutMethods();
    return res.data?.payoutMethods ?? [];
  }, []);

  const handleAdd = useCallback(
    async (
      payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">,
    ): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertExpertPayoutMethod(payload);
      const methods = res.data?.payoutMethods ?? [];
      const saved = methods[methods.length - 1];
      if (!res.success || !saved) {
        throw new Error(res.message || "Failed to save payout method");
      }
      return saved;
    },
    [],
  );

  const handleUpdate = useCallback(
    async (
      methodId: string,
      payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">,
    ): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertExpertPayoutMethod({
        ...payload,
        id: methodId,
      } as Omit<IPayoutMethod, "addedAt" | "updatedAt">);
      const saved = res.data?.payoutMethods?.find(
        (method) => method.id === methodId,
      );
      if (!res.success || !saved) {
        throw new Error(res.message || "Failed to update payout method");
      }
      return saved;
    },
    [],
  );

  const handleDelete = useCallback(async (methodId: string) => {
    const res = await payoutApi.deleteExpertPayoutMethod(methodId);
    if (!res.success) {
      throw new Error(res.message || "Failed to remove payout method");
    }
  }, []);

  const handleSetDefault = useCallback(async (methodId: string) => {
    const res = await payoutApi.setExpertDefaultPayoutMethod(methodId);
    if (!res.success) {
      throw new Error(res.message || "Failed to set default payout method");
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8 sm:space-y-8">
      {/* ── Page header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-power-orange/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10">
            <BadgeIndianRupee size={22} className="text-power-orange" />
          </div>
          <div>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
              Expert
            </span>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
              Payout Settings
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-200">
              Manage how you receive earnings from your expert sessions. Your
              payout method is used when a completed session's payment is
              released to you.
            </p>
          </div>
        </div>
      </div>

      {/* ── Payout manager ── */}
      <PayoutMethodManager
        ownerType="Expert"
        onLoad={handleLoad}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />

      {/* ── Info cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InfoCard
          icon={Zap}
          title="Fast Payouts"
          description="Earnings are released within 24 hours of a session being marked completed."
        />
        <InfoCard
          icon={ShieldCheck}
          title="Secure & Encrypted"
          description="Your banking details are AES-256 encrypted at rest and never shared with third parties."
        />
        <InfoCard
          icon={Info}
          title="Multiple Methods"
          description="Add more than one payout method and choose the primary one for payouts."
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
    <div className="rounded-xl border-0 bg-white p-5 shadow-[0_2px_16px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgb(0,0,0,0.1)] sm:p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-power-orange/15 mb-3">
        <Icon size={20} className="text-power-orange" />
      </div>
      <p className="mb-2 text-base font-bold text-slate-900">{title}</p>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
