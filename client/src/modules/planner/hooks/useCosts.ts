"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { plannerApi } from "@/modules/planner/services/planner";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Travel and stay estimates for the events on the plan and the ones suggested.
 *
 * Read on its own query, apart from the plan, because estimating can take a
 * moment the first time a trip is priced. The plan and the suggestions render
 * straight away and the figures arrive when they are ready.
 *
 * The previous answer stays on screen while a new one loads, so adding an event
 * does not blank every other event's figures for the length of a request.
 */
export function useCosts(dependentId: string, slugs: string[]) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);

  const query = useQuery({
    queryKey: queryKeys.planner.costs(dependentId, slugs),
    queryFn: () => plannerApi.getCosts(dependentId, slugs),
    enabled: hydrated && Boolean(token) && Boolean(dependentId),
    placeholderData: keepPreviousData,
    // A trip priced a moment ago will be priced the same again.
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Saves the home city on the profile. Every estimate started from the old home,
   * so all of this child's cost queries are refetched.
   */
  const saveHomeCity = useMutation({
    mutationFn: (city: string) => plannerApi.saveHomeCity(city),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.planner.costsFor(dependentId) });
      toast.success("City saved.");
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message || "Could not save your city.");
    },
  });

  return {
    costs: query.data ?? null,
    isLoading: query.isPending && hydrated && Boolean(token),
    isError: query.isError,
    saveHomeCity,
  };
}
