"use client";

import { queryKeys } from "@/lib/query/keys";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { User } from "@/types";
import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

/**
 * The signed-in user's profile.
 *
 * `authApi.getProfile()` was previously called from 9 independent places, several
 * of which re-fetched a user the auth store already held, each with its own
 * loading flag and error handling. This is the one place it is fetched now.
 *
 * The query cache is scoped to the session by `QueryProvider`, so this key needs
 * no user id in it — see the note there.
 */

export const profileQueryKey = queryKeys.auth.profile;

/** The one fetcher for the signed-in profile. Shared by hook and imperative use. */
const fetchProfile = async (
  setUser: (user: User | null) => void,
): Promise<User | null> => {
  const response = await authApi.getProfile();
  const user = response.success ? (response.data ?? null) : null;

  // The store stays the source of truth for identity — guards, nav and the
  // socket provider all read it — so a fresh profile is written back rather
  // than living only in the query cache.
  if (user) setUser(user);

  return user;
};

export const useProfile = (): UseQueryResult<User | null> => {
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);

  return useQuery({
    queryKey: profileQueryKey,
    queryFn: () => fetchProfile(setUser),
    // Do not fire while the session is still being restored, and never for a
    // signed-out visitor: the request would 401, and the axios interceptor
    // responds to a 401 with a full-page redirect to /login.
    enabled: hydrated && Boolean(token),
  });
};

/**
 * Update the profile and refresh what everything else is reading.
 *
 * Without invalidation here, a page that saved a change and a page that had
 * already cached the profile would disagree until one of them remounted.
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (data: Parameters<typeof authApi.updateProfile>[0]) => {
      const response = await authApi.updateProfile(data);
      if (!response.success) {
        throw new Error(response.message || "Failed to update profile");
      }
      return response.data ?? null;
    },
    onSuccess: (user) => {
      if (user) setUser(user);
      void queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
  });
};

/**
 * Imperative access to the same cached profile.
 *
 * Several pages load the profile inside a `Promise.all` alongside their own
 * entity fetches (both checkouts, the payment page, coach verification). Those
 * need the value *inside* an effect rather than as a hook result, and
 * restructuring 1,700-line revenue pages to invert that is a change out of all
 * proportion to the benefit.
 *
 * `fetchQuery` gives them the value imperatively while still going through the
 * shared cache under the same key: a profile already fetched by `useProfile`
 * is returned without a request, and a profile fetched here populates the cache
 * for every hook consumer. That is what removes the duplicate fetching — nine
 * independent callers collapse onto one cache entry — without touching page
 * structure.
 */
export const useFetchProfile = (): (() => Promise<User | null>) => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: profileQueryKey,
        queryFn: () => fetchProfile(setUser),
      }),
    [queryClient, setUser],
  );
};

/**
 * Imperative access that always goes to the network.
 *
 * `useFetchProfile` honours the 30s default `staleTime`, which is what makes it
 * a shared cache read. Callers that have just *written* to the profile need the
 * opposite: a page that adds a dependent and then re-reads inside that window
 * would render the pre-write profile back to the user.
 */
export const useRefreshProfile = (): (() => Promise<User | null>) => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: profileQueryKey,
        queryFn: () => fetchProfile(setUser),
        staleTime: 0,
      }),
    [queryClient, setUser],
  );
};
