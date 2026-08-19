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
        useAuthStore.setState({ user: JSON.parse(user) });
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
