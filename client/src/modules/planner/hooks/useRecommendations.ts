"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { plannerApi } from "@/modules/planner/services/planner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * The season suggestions for one child.
 *
 * ── Why reading and making are separate ─────────────────────────────────────
 * Opening the page only READS what is saved, which is free. A suggestion is
 * made when the parent asks for one, because each fresh answer is a model call
 * and the day's allowance is limited. Making it automatically on every visit
 * would spend that allowance on parents who only came to look.
 */
export function useRecommendations(dependentId: string) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const key = queryKeys.planner.recommendations(dependentId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => plannerApi.getRecommendations(dependentId),
    enabled: hydrated && Boolean(token) && Boolean(dependentId),
  });

  const suggest = useMutation({
    mutationFn: (force: boolean) => plannerApi.suggest(dependentId, force),
    // The response is the new saved state, so it goes straight into the cache.
    onSuccess: (response) => queryClient.setQueryData(key, response),
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message || "Could not make suggestions just now.");
    },
  });

  return {
    isLoading: query.isPending && hydrated && Boolean(token),
    isError: query.isError,
    recommendations: query.data?.recommendations ?? null,
    usage: query.data?.usage ?? null,
    suggest,
  };
}
