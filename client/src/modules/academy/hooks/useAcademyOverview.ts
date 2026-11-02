"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useQuery } from "@tanstack/react-query";
import { academyConsoleApi } from "../services/academyConsole";
import { hasFigures } from "../utils/academyStatus";

/**
 * Everything the overview shows, in the order it is needed. The academy comes
 * first because it decides whether the figures are worth asking for at all:
 * an academy still in setup or review has no earnings to fetch.
 *
 * The figures are separate queries so that a failure in one of them leaves the
 * status, which is the part the owner cannot do without, on screen.
 */
export function useAcademyOverview() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const signedIn = hydrated && Boolean(token);

  const academy = useQuery({
    queryKey: queryKeys.academy.mine,
    queryFn: () => academyConsoleApi.getMine(),
    enabled: signedIn,
  });

  const wantsFigures = hasFigures(academy.data ?? null);

  const earnings = useQuery({
    queryKey: queryKeys.academy.earnings,
    queryFn: () => academyConsoleApi.getEarnings(),
    enabled: signedIn && wantsFigures,
  });

  const analytics = useQuery({
    queryKey: queryKeys.academy.analytics,
    queryFn: () => academyConsoleApi.getAnalytics(),
    enabled: signedIn && wantsFigures,
  });

  return { academy, earnings, analytics, wantsFigures };
}
