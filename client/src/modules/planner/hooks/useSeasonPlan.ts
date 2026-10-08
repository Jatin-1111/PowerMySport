"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  seasonPlanApi,
  type PlanPreferences,
  type SeasonPlanData,
  type SeasonPlanEntryStatus,
} from "@/modules/planner/services/seasonPlan";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * One child's plan, and the three things a parent does to it.
 *
 * ── Why every mutation writes the response straight into the cache ──────────
 * The API returns the whole plan after every change, so `setQueryData` with
 * that response is exact. Invalidating instead would be a second round trip to
 * learn something the first one already told us, and optimistic patching would
 * be a guess about a write the server may have adjusted — it reads the
 * tournament's name and date off the calendar rather than taking ours.
 */
export function useSeasonPlan(dependentId: string) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const key = queryKeys.seasonPlan.forDependent(dependentId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => seasonPlanApi.get(dependentId),
    enabled: hydrated && Boolean(token) && Boolean(dependentId),
  });

  /**
   * Every change to the plan or its preferences changes what the suggestions were
   * built from. The saved suggestions are re-read, which is free, so the page can
   * say they are out of date instead of presenting them as current.
   */
  const apply = (plan: SeasonPlanData) => {
    queryClient.setQueryData(key, plan);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.planner.recommendations(dependentId),
    });
    // Costs follow the plan: a new event, a removed one or a typed figure all
    // change the season total.
    void queryClient.invalidateQueries({ queryKey: queryKeys.planner.costsFor(dependentId) });
  };

  /** The server's message is the useful one — it says which rule was hit. */
  const failed = (fallback: string) => (error: unknown) => {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message;
    toast.error(message || fallback);
  };

  const add = useMutation({
    mutationFn: (editionSlug: string) => seasonPlanApi.add(dependentId, editionSlug),
    onSuccess: (plan) => {
      apply(plan);
      toast.success("Added to the plan.");
    },
    onError: failed("Could not add that tournament."),
  });

  const setStatus = useMutation({
    mutationFn: (input: { editionSlug: string; status: SeasonPlanEntryStatus }) =>
      seasonPlanApi.setStatus(dependentId, input.editionSlug, input.status),
    onSuccess: apply,
    onError: failed("Could not update that tournament."),
  });

  const remove = useMutation({
    mutationFn: (editionSlug: string) => seasonPlanApi.remove(dependentId, editionSlug),
    onSuccess: (plan) => {
      apply(plan);
      toast.success("Removed from the plan.");
    },
    onError: failed("Could not remove that tournament."),
  });

  const setCosts = useMutation({
    mutationFn: (input: {
      editionSlug: string;
      costs: Parameters<typeof seasonPlanApi.setCosts>[2];
    }) => seasonPlanApi.setCosts(dependentId, input.editionSlug, input.costs),
    onSuccess: (plan) => {
      apply(plan);
      toast.success("Figures saved.");
    },
    onError: failed("Could not save those figures."),
  });

  const savePreferences = useMutation({
    mutationFn: (preferences: PlanPreferences) =>
      seasonPlanApi.setPreferences(dependentId, preferences),
    onSuccess: (plan) => {
      apply(plan);
      toast.success("Setup saved.");
    },
    onError: failed("Could not save your setup."),
  });

  const entries = query.data?.entries ?? [];

  return {
    entries,
    /** The parent's goal and blocked dates. Defaults until a plan has been saved. */
    preferences: query.data?.preferences,
    isLoading: query.isPending && hydrated && Boolean(token),
    /** Slugs already on the plan, so a list can mark what is already chosen. */
    plannedSlugs: new Set(entries.map((entry) => entry.editionSlug)),
    add,
    setStatus,
    remove,
    setCosts,
    savePreferences,
  };
}
