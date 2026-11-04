"use client";

import { RouteError } from "@/components/layout/RouteFallbacks";

/**
 * Error boundary for this route group. Scopes a thrown render to this segment
 * instead of letting it escape to the root and blank the whole page.
 */
export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Surfaced for the browser console / error reporting; not shown to the user.
  console.error("Route error:", error);
  return <RouteError reset={reset} homeHref="/shop" />;
}
