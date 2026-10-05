"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { plannerApi } from "@/modules/planner/services/planner";
import { useQuery } from "@tanstack/react-query";

/**
 * The judged planner for one child.
 *
 * ── Why the plan inside the response is not what the page reads ─────────────
 * The overview carries the child's plan because the assistant chat needs both
 * halves in one answer. The page does not: it reads and writes the plan through
 * `useSeasonPlan`, whose cache every add, advance and remove already updates.
 * Showing the copy inside this response would mean two caches for one list, and
 * a parent who marks an event entered would see the other copy lag behind.
 *
 * ── Why it is gated on the session ──────────────────────────────────────────
 * The axios interceptor answers a 401 by navigating away, so a request fired
 * before the session hydrates can throw a signed-in user off the page.
 */
export function usePlanner(dependentId: string | null) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);

  return useQuery({
    queryKey: queryKeys.planner.forDependent(dependentId ?? ""),
    queryFn: () => plannerApi.get(dependentId!),
    enabled: hydrated && Boolean(token) && Boolean(dependentId),
    // The calendar and the lists change weekly, not by the minute.
    staleTime: 5 * 60 * 1000,
  });
}
