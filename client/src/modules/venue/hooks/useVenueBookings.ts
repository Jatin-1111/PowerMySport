"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { bookingApi } from "@/modules/booking/services/booking";
import { venueApi } from "@/modules/venue/services/venue";
import { useQuery } from "@tanstack/react-query";

/**
 * The venue lister's venues and bookings. The overview and the bookings page
 * read the same cache entries, so answering a request on one is visible on
 * the other without a refetch.
 */
export function useVenueBookings() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const signedIn = hydrated && Boolean(token);

  const venues = useQuery({
    queryKey: queryKeys.venueConsole.venues,
    queryFn: async () => {
      const res = await venueApi.getMyVenues({ limit: 100 });
      if (!res.success) throw new Error("We could not load your venues.");
      return res.data ?? [];
    },
    enabled: signedIn,
  });

  const bookings = useQuery({
    queryKey: queryKeys.venueConsole.bookings,
    queryFn: async () => {
      const res = await bookingApi.getMyBookings({ limit: 100 });
      if (!res.success) throw new Error("We could not load your bookings.");
      return res.data ?? [];
    },
    enabled: signedIn,
  });

  return { venues, bookings };
}
