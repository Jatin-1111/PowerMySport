"use client";

import { PayoutMethodManager } from "@/modules/shared/components/payout/PayoutMethodManagerV2";
import { PayoutsPage } from "@/modules/shared/components/payout/PayoutsPage";
import { payoutApi } from "@/modules/shared/services/payout";
import { IPayoutMethod } from "@/types";
import { useCallback } from "react";

const FACTS = [
  {
    term: "When you are paid",
    detail: "Your primary method is used when a completed session's payment is released.",
  },
  {
    term: "Stored encrypted",
    detail: "Your bank or UPI details are encrypted at rest and are not shared with other parties.",
  },
  {
    term: "More than one method",
    detail: "Add as many as you like and choose which one is primary.",
  },
];

export default function ExpertPayoutsPage() {
  const handleLoad = useCallback(async (): Promise<IPayoutMethod[]> => {
    const res = await payoutApi.getExpertPayoutMethods();
    return res.data?.payoutMethods ?? [];
  }, []);

  const handleAdd = useCallback(
    async (
      payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">
    ): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertExpertPayoutMethod(payload);
      const methods = res.data?.payoutMethods ?? [];
      const saved = methods[methods.length - 1];
      if (!res.success || !saved) {
        throw new Error(res.message || "Failed to save payout method");
      }
      return saved;
    },
    []
  );

  const handleUpdate = useCallback(
    async (
      methodId: string,
      payload: Omit<IPayoutMethod, "id" | "addedAt" | "updatedAt">
    ): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertExpertPayoutMethod({
        ...payload,
        id: methodId,
      } as Omit<IPayoutMethod, "addedAt" | "updatedAt">);
      const saved = res.data?.payoutMethods?.find((method) => method.id === methodId);
      if (!res.success || !saved) {
        throw new Error(res.message || "Failed to update payout method");
      }
      return saved;
    },
    []
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
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PayoutsPage
        consoleLabel="Expert console"
        intro="Where we send what you earn from your expert sessions."
        facts={FACTS}
      >
        <PayoutMethodManager
          ownerType="Expert"
          onLoad={handleLoad}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
        />
      </PayoutsPage>
    </div>
  );
}
