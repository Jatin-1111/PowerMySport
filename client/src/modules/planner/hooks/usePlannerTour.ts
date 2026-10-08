"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { plannerApi } from "@/modules/planner/services/planner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Whether to show the planner's tour.
 *
 * The flag is on the parent's account (`User.plannerTourSeen`), so finishing the
 * tour on a phone means a laptop does not show it again. The tour opens by itself
 * only once the server has said "not seen": while that is unknown, or if it cannot be
 * asked, nothing opens, because a tour that appears on every visit when the request
 * fails is worse than one that is missing.
 *
 * "How this works" replays it. That is local state, so replaying does not clear the
 * flag and a reload does not bring the tour back.
 */
export function usePlannerTour() {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const [replaying, setReplaying] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.planner.tour,
    queryFn: () => plannerApi.getTourSeen(),
    enabled: hydrated && Boolean(token),
    staleTime: Infinity,
  });

  const markSeen = useMutation({
    mutationFn: () => plannerApi.setTourSeen(true),
    // The tour closes at once. If the save fails it simply shows again next visit.
    onMutate: () => {
      queryClient.setQueryData(queryKeys.planner.tour, true);
    },
  });

  const open = replaying || query.data === false;

  return {
    open,
    start: () => setReplaying(true),
    finish: () => {
      setReplaying(false);
      if (query.data !== true) markSeen.mutate();
    },
  };
}
