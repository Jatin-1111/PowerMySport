"use client";

import { payoutApi } from "@/modules/shared/services/payout";
import { PayoutMethodManager } from "@/modules/shared/components/payout/PayoutMethodManagerV2";
import { IPayoutMethod } from "@/types";
import { useCallback } from "react";
import React from "react";
import { BadgeIndianRupee, Info, ShieldCheck, Zap } from "lucide-react";

export default function CoachPayoutsPage() {
  const handleLoad = useCallback(async (): Promise<IPayoutMethod[]> => {
    const res = await payoutApi.getCoachPayoutMethods();
    return res.data?.payoutMethods ?? [];
  }, []);

  const handleAdd = useCallback(
    async (
      payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">,
    ): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertCoachPayoutMethod(payload);
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
      const res = await payoutApi.upsertCoachPayoutMethod({
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
    const res = await payoutApi.deleteCoachPayoutMethod(methodId);
    if (!res.success) {
      throw new Error(res.message || "Failed to remove payout method");
    }
  }, []);

  const handleSetDefault = useCallback(async (methodId: string) => {
    const res = await payoutApi.setCoachDefaultPayoutMethod(methodId);
    if (!res.success) {
      throw new Error(res.message || "Failed to set default payout method");
    }
  }, []);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Page header ── */}
      <div className="rounded-xl border border-slate-200 bg-linear-to-br from-blue-50 to-indigo-50 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-power-orange/15 shrink-0">
            <BadgeIndianRupee size={24} className="text-power-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Payout Settings
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage how you receive earnings from your coaching sessions. Your
              payout method is used when a booking is completed and funds are
              released.
            </p>
          </div>
        </div>
      </div>

      {/* ── Payout manager ── */}
      <PayoutMethodManager
        ownerType="Coach"
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
          description="Earnings are released within 2–3 business days after a session is completed."
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
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-power-orange/15 mb-3">
        <Icon size={20} className="text-power-orange" />
      </div>
      <p className="mb-2 text-base font-bold text-slate-900">{title}</p>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}
