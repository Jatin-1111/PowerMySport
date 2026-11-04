"use client";

import { queryKeys } from "@/lib/query/keys";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { opportunityFollowsApi } from "../services/opportunityFollows";

/**
 * Whether the signed-in parent follows one entry, and the switch for it.
 *
 * The page itself is public and cached, so nothing about the parent is known on
 * the server: this reads the follow list in the browser, and only once a
 * session exists. `signedIn` is false until the auth store has finished reading
 * localStorage, so a signed-in parent is never shown a "sign in" prompt first.
 */
export function useOpportunityFollow(slug: string) {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const signedIn = hydrated && Boolean(token);

  const query = useQuery({
    queryKey: queryKeys.opportunityFollows.all,
    queryFn: opportunityFollowsApi.list,
    enabled: signedIn,
  });

  const toggle = useMutation({
    mutationFn: async (follow: boolean) => {
      if (follow) await opportunityFollowsApi.follow(slug);
      else await opportunityFollowsApi.unfollow(slug);
      return follow;
    },
    onSuccess: (follow) => {
      queryClient.setQueryData<string[]>(queryKeys.opportunityFollows.all, (slugs = []) =>
        follow ? [...new Set([...slugs, slug])] : slugs.filter((item) => item !== slug)
      );
      toast.success(follow ? "We will tell you when the dates move." : "You will not get alerts.");
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message ?? "Could not do that just now.");
    },
  });

  return {
    /** False while the session is still being read, and for a signed-out visitor. */
    signedIn,
    hydrated,
    ready: !signedIn || query.isSuccess,
    following: query.data?.includes(slug) ?? false,
    toggle,
  };
}
