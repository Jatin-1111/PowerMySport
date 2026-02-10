"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/modules/auth/store/authStore";

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
  }, []);

  return <>{children}</>;
}

