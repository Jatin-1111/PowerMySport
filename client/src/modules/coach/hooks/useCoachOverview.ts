"use client";

import { queryKeys } from "@/lib/query/keys";
import { bookingApi } from "@/modules/booking/services/booking";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { coachApi } from "@/modules/coach/services/coach";
import { useQuery } from "@tanstack/react-query";

/**
 * Everything the coach overview shows. The profile comes first and decides
 * whether the page can render at all; earnings, analytics and bookings are
 * separate queries so one of them failing leaves the rest on screen.
 */
export function useCoachOverview() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const signedIn = hydrated && Boolean(token);

  const profile = useQuery({
    queryKey: queryKeys.coachConsole.profile,
    queryFn: async () => {
      const res = await coachApi.getMyProfile();
      if (!res.success || !res.data) throw new Error("We could not load your profile.");
      return res.data;
    },
    enabled: signedIn,
  });

  const earnings = useQuery({
    queryKey: queryKeys.coachConsole.earnings,
    queryFn: async () => {
      const res = await coachApi.getEarnings();
      if (!res.success || !res.data) throw new Error("We could not load your earnings.");
      return res.data;
    },
    enabled: signedIn,
  });

  const analytics = useQuery({
    queryKey: queryKeys.coachConsole.analytics,
    queryFn: async () => {
      const res = await coachApi.getAnalytics();
      if (!res.success || !res.data) throw new Error("We could not load your analytics.");
      return res.data;
    },
    enabled: signedIn,
  });

  const bookings = useQuery({
    queryKey: queryKeys.coachConsole.bookings,
    queryFn: async () => {
      const res = await bookingApi.getMyBookings();
      if (!res.success) throw new Error("We could not load your bookings.");
      return (res.data ?? []).filter((booking) => booking.coachId);
    },
    enabled: signedIn,
  });

  return { profile, earnings, analytics, bookings };
}
