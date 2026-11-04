"use client";

import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { expertApi, type ExpertSession } from "@/modules/expert/services/expert";
import { sessionKey } from "@/modules/expert/utils/sessions";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * The expert's profile and sessions, as two independent queries so one failing
 * leaves the other on screen. The overview and the sessions page read the same
 * cache entries, so answering a request on one shows on the other.
 */
export function useExpertConsole() {
  const queryClient = useQueryClient();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const signedIn = hydrated && Boolean(token);

  const profile = useQuery({
    queryKey: queryKeys.expertConsole.profile,
    queryFn: async () => {
      const res = await expertApi.getMyProfile();
      if (!res.success || !res.data) throw new Error("We could not load your profile.");
      return res.data;
    },
    enabled: signedIn,
  });

  const sessions = useQuery({
    queryKey: queryKeys.expertConsole.sessions,
    queryFn: async () => {
      const res = await expertApi.expertSessions();
      if (!res.success) throw new Error("We could not load your sessions.");
      return res.data ?? [];
    },
    enabled: signedIn,
  });

  /** Fold one changed session back into the cached list. */
  const updateSession = (updated: ExpertSession) =>
    queryClient.setQueryData<ExpertSession[]>(queryKeys.expertConsole.sessions, (current) =>
      (current ?? []).map((s, i) =>
        sessionKey(s, i) === sessionKey(updated) ? { ...s, ...updated } : s
      )
    );

  return { profile, sessions, updateSession };
}
