"use client";

import { useSessionExpiry } from "@/modules/auth/hooks/useSessionExpiry";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { useEffect } from "react";

/**
 * HydrationBoundary
 *
 * Handles client-side hydration of auth state from localStorage.
 * This component ensures that:
 * 1. Auth store is rehydrated after page refresh
 * 2. SSR hydration mismatches are prevented
 * 3. Token and user data are restored from localStorage
 *
 * Placement: Should wrap the entire app in the root layout
 */
export function HydrationBoundary({ children }: { children: React.ReactNode }) {
  // Also the one place that decides what an expired session does, because this
  // component already owns session bootstrapping and sits above QueryProvider.
  useSessionExpiry();

  useEffect(() => {
    // Only run on client side, after initial render
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");

    if (token) {
      useAuthStore.setState({ token });
    }

    if (user) {
      try {
        const saved = JSON.parse(user);
        // Children saved by an earlier version are grouped (`sport`, `physical`, ...),
        // not flat, and every screen now reads them flat. They are refetched the moment
        // the profile loads, so drop them rather than show them half-empty meanwhile.
        // Remove this once no browser can still hold a user saved before this change.
        const isOldShape = (d: Record<string, unknown>) =>
          "sport" in d || "physical" in d || "practical" in d || "standing" in d;
        if (Array.isArray(saved.dependents) && saved.dependents.some(isOldShape)) {
          delete saved.dependents;
        }
        // Every screen reads `user.role`; a saved object without one is unusable,
        // and the header crashes the whole marketing layout on it.
        if (!saved || typeof saved.role !== "string") {
          localStorage.removeItem("user");
        } else {
          useAuthStore.setState({ user: saved });
        }
      } catch (error) {
        console.error("Failed to parse user from localStorage:", error);
        localStorage.removeItem("user");
      }
    }

    // Always last, and always set — even when there was nothing to restore.
    // Route guards block on this flag, so failing to set it on the signed-out
    // path would leave every protected page stuck on its loading state.
    useAuthStore.setState({ hydrated: true });
  }, []);

  return <>{children}</>;
}
