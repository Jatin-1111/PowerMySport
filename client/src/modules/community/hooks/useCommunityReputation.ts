"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { communityApi, type CommunityReputation } from "@/modules/community/services/community";
import { useDashboardAudience } from "@/modules/player/hooks/useDashboardAudience";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * The signed-in user's community standing.
 *
 * `enabled` is doing real work here, not just saving a request. The endpoint is
 * Parent-only on the server, and the axios interceptor answers a 401 with a
 * full-page redirect to /login — so firing it for a Player, or before the
 * session has hydrated, risks throwing the user off the page they are on.
 * Gating on both the session and the role keeps it to calls that can succeed.
 */
export const useCommunityReputation = (): UseQueryResult<CommunityReputation> => {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const { isParent } = useDashboardAudience();

  return useQuery({
    queryKey: queryKeys.community.reputation,
    queryFn: () => communityApi.getReputation(),
    enabled: hydrated && Boolean(token) && isParent,
  });
};
