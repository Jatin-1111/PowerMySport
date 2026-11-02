"use client";

import { PayoutMethodManager } from "@/modules/shared/components/payout/PayoutMethodManager";
import { PayoutsPage } from "@/modules/shared/components/payout/PayoutsPage";
import { payoutApi } from "@/modules/shared/services/payout";
import { IPayoutMethod } from "@/types";
import { useCallback } from "react";

const FACTS = [
  {
    term: "One method for every venue",
    detail: "Earnings from each of your venues are paid to the same account.",
  },
  {
    term: "Stored encrypted",
    detail: "Your bank or UPI details are encrypted at rest and are not shared with other parties.",
  },
  {
    term: "Changing it later",
    detail:
      "A new method applies to future payouts. A payout already in progress goes to the method it was started with.",
  },
];

export default function VenuePayoutsPage() {
  const handleLoad = useCallback(async (): Promise<IPayoutMethod | null> => {
    const res = await payoutApi.getVenuePayoutMethod();
    return res.data?.payoutMethod ?? null;
  }, []);

  const handleSave = useCallback(
    async (payload: Omit<IPayoutMethod, "addedAt" | "updatedAt">): Promise<IPayoutMethod> => {
      const res = await payoutApi.upsertVenuePayoutMethod(payload);
      if (!res.success || !res.data?.payoutMethods?.length) {
        throw new Error(res.message || "Failed to save payout method");
      }
      return res.data.payoutMethods[res.data.payoutMethods.length - 1];
    },
    []
  );

  const handleDelete = useCallback(async () => {
    const res = await payoutApi.deleteVenuePayoutMethod();
    if (!res.success) {
      throw new Error(res.message || "Failed to remove payout method");
    }
  }, []);

  return (
    <PayoutsPage
      consoleLabel="Venue console"
      intro="Where we send what your venues earn from bookings."
      facts={FACTS}
    >
      <PayoutMethodManager
        ownerType="VENUE"
        onLoad={handleLoad}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </PayoutsPage>
  );
}
