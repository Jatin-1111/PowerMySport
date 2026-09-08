"use client";

import { queryKeys } from "@/lib/query/keys";
import { authApi } from "@/modules/auth/services/auth";
import type { Dependent } from "@/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Add a child, and make every reader of the profile agree afterwards.
 *
 * The invalidation is the whole point of routing this through a hook. The
 * dashboard reads dependents from the cached `useProfile` entry, while
 * `/dashboard/my-profile` re-reads the profile with `staleTime: 0`. Add a child
 * from the dashboard without invalidating and the two disagree for the rest of
 * the stale window — the roster shows the new child, the profile page doesn't,
 * and nothing in the UI explains why.
 *
 * `authApi.addDependent` already flattens the payload through
 * `denormalizeDependent`, so callers pass the nested shape.
 */
export const useAddDependent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Dependent) => {
      const response = await authApi.addDependent(data);
      if (!response.success) {
        throw new Error(response.message || "Failed to add dependent");
      }
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
};
