"use client";

import axiosInstance from "@/lib/api/axios";
import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useQuery } from "@tanstack/react-query";

/**
 * The subscription price breakdown, in paise, from the server that will charge it.
 *
 * Replaces a client-side recomputation from `NEXT_PUBLIC_SUBSCRIPTION_*` rate
 * copies — the same drift risk as the booking quote, in the same shape.
 */

export type SubscriptionBreakdown = {
  basePaise: number;
  platformFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  isZeroCommission: boolean;
};

export const useSubscriptionQuote = (
  basePaise: number
): { breakdown: SubscriptionBreakdown; isQuoteLoading: boolean } => {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);
  const enabled = hydrated && Boolean(token) && basePaise > 0;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.bookings.subscriptionQuote(basePaise),
    queryFn: async () => {
      const response = await axiosInstance.post("/coaches/subscriptions/quote", {
        basePaise,
      });
      return response.data.data as Omit<SubscriptionBreakdown, "isZeroCommission">;
    },
    enabled,
    staleTime: 5 * 60_000,
  });

  const breakdown: SubscriptionBreakdown = data
    ? { ...data, isZeroCommission: data.platformFeePaise === 0 }
    : {
        // Until the server answers, show the base only — never a fee we guessed.
        basePaise,
        platformFeePaise: 0,
        taxPaise: 0,
        totalPaise: basePaise,
        isZeroCommission: true,
      };

  return { breakdown, isQuoteLoading: enabled && isPending };
};
