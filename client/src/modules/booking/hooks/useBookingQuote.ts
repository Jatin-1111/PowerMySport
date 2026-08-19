"use client";

import axiosInstance from "@/lib/api/axios";
import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useQuery } from "@tanstack/react-query";

/**
 * The fee breakdown for a booking, as computed by the server that will charge it.
 *
 * Both checkouts used to derive this themselves from `NEXT_PUBLIC_SERVICE_FEE_RATE`
 * and `NEXT_PUBLIC_TAX_RATE` — a second copy of numbers the API owns, configured
 * separately, agreeing only by luck. A change to one side without the other would
 * quote a customer a price the API then refused to honour. Now the client renders
 * a number it was given rather than one it invented.
 */

export type BookingFeeBreakdown = {
  subtotal: number;
  serviceFee: number;
  tax: number;
  total: number;
};

/** Shown while the quote is in flight, so no wrong number is ever displayed. */
const pendingBreakdown = (
  subtotal: number,
  discount: number,
): BookingFeeBreakdown => ({
  subtotal,
  serviceFee: 0,
  tax: 0,
  total: Math.max(0, subtotal - discount),
});

export const useBookingQuote = (
  subtotal: number,
  discount: number = 0,
): { quote: BookingFeeBreakdown; isQuoteLoading: boolean } => {
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  // Only price a real booking: a zero subtotal means the slot is not configured
  // yet, and the endpoint is authenticated.
  const enabled = hydrated && Boolean(token) && subtotal > 0;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.bookings.quote(subtotal, discount),
    queryFn: async (): Promise<BookingFeeBreakdown> => {
      const response = await axiosInstance.post("/bookings/quote", {
        subtotal,
        discount,
      });
      return response.data.data;
    },
    enabled,
    // The breakdown for a given subtotal/discount pair cannot change under us,
    // so there is nothing to revalidate while the user sits on the page.
    staleTime: 5 * 60_000,
  });

  return {
    quote: data ?? pendingBreakdown(subtotal, discount),
    isQuoteLoading: enabled && isPending,
  };
};
