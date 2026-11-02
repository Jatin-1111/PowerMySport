"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { venueConsoleApi } from "@/modules/venue/services/venueConsole";
import { useQuery } from "@tanstack/react-query";
import { useVenueBookings } from "./useVenueBookings";

/**
 * Everything the venue overview shows. The venue list decides whether the page
 * can render at all; earnings, analytics and bookings are separate queries so
 * one of them failing leaves the rest on screen.
 */
export function useVenueOverview() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const signedIn = hydrated && Boolean(token);

  const { venues, bookings } = useVenueBookings();

  const earnings = useQuery({
    queryKey: queryKeys.venueConsole.earnings,
    queryFn: async () => {
      const res = await venueConsoleApi.getEarnings();
      if (!res.success || !res.data) throw new Error("We could not load your earnings.");
      return res.data;
    },
    enabled: signedIn,
  });

  const analytics = useQuery({
    queryKey: queryKeys.venueConsole.analytics,
    queryFn: async () => {
      const res = await venueConsoleApi.getAnalytics();
      if (!res.success || !res.data) throw new Error("We could not load your analytics.");
      return res.data;
    },
    enabled: signedIn,
  });

  return { venues, earnings, analytics, bookings };
}
