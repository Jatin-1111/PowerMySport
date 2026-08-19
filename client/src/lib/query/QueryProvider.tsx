"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

/**
 * Owns server state, and owns the one thing no layer previously owned: cache
 * identity.
 *
 * Before this, server data was fetched in `useEffect` and parked in `useState`
 * (226 effects, no shared cache, no dedup, no consistent loading contract), plus
 * one hand-rolled `requestCache` module (now deleted) used by 3 of ~25 services.
 * That cache was keyed by URL alone and never cleared on logout, so on a shared
 * device — which this product is built around, a parent and a coach on one
 * laptop — the next user could be served the previous user's bookings and
 * friend list.
 *
 * The fix is structural rather than a key-naming convention: the cache is scoped
 * to the *session*, and emptied whenever the signed-in identity changes. Query
 * keys therefore do not need a user id baked into them, which matters because a
 * convention like that only works while everyone remembers it.
 */

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough to stop the duplicate fetching this layer exists to
        // remove (the profile alone was fetched from 9 independent places),
        // short enough that dashboards do not feel stale.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        // The API's axios interceptor already reacts to 401 by clearing the
        // session, so retrying an auth failure just multiplies the damage.
        retryOnMount: false,
        refetchOnWindowFocus: false,
      },
    },
  });

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Created once per mount, not per render: a new QueryClient would throw away
  // every cached entry on any re-render of this provider.
  const [queryClient] = useState(makeQueryClient);

  const userId = useAuthStore((state) => state.user?.id ?? null);
  const hydrated = useAuthStore((state) => state.hydrated);

  // `undefined` means "no identity observed yet", which is distinct from `null`
  // meaning "observed, and signed out".
  const lastIdentity = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Wait for hydration. Before it completes, `userId` is null for everyone,
    // including signed-in users, so acting here would clear the cache on every
    // page load rather than on genuine identity changes.
    if (!hydrated) return;

    if (lastIdentity.current === undefined) {
      lastIdentity.current = userId;
      return;
    }

    if (lastIdentity.current === userId) return;

    lastIdentity.current = userId;

    // Identity actually changed — login, logout, or an account switch. Drop
    // everything: whatever is cached belongs to whoever was signed in before.
    queryClient.clear();
  }, [userId, hydrated, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
