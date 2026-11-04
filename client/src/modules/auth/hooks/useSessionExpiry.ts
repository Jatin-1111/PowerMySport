"use client";

import { loginUrlFor } from "@/flow/policy";
import { setUnauthorizedHandler } from "@/lib/api/axios";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Owns what happens when the API reports the session is gone.
 *
 * The axios response interceptor used to own this, which is the wrong layer: it
 * has no router and no store, so its only available verb was
 * `window.location.href = "/login"`. That cost three things every time a token
 * expired — the page the user was on, all in-memory state, and any chance of a
 * graceful re-auth. It also raced the route guards, overwriting their
 * `router.replace` with a bare `/login` that had no return path.
 *
 * Registering here fixes all of that at once:
 *
 *   - `logout()` is the one owner of session teardown, so the localStorage keys
 *     are not also known to the transport layer.
 *   - Clearing the store is what `QueryProvider` watches, so the query cache is
 *     dropped by the same mechanism that handles an ordinary sign-out rather than
 *     by reloading the document.
 *   - `router.replace` means the guards and this handler now navigate through the
 *     same layer, so neither can silently overwrite the other.
 *   - The return path survives, via the same `loginUrlFor` the guards and
 *     `proxy.ts` use. One owner for the login URL, which is what RC-7 was about.
 *
 * Mounted once, in `HydrationBoundary`, which already owns session bootstrapping
 * and sits above `QueryProvider` in the root layout.
 */
export const useSessionExpiry = (): void => {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  useEffect(
    () =>
      setUnauthorizedHandler((returnTo) => {
        logout();

        // A null return path means we are already on an auth page: the session is
        // cleared, but sending them to login from login would be a no-op reload.
        if (returnTo !== null) router.replace(loginUrlFor(returnTo));
      }),
    [logout, router]
  );
};
