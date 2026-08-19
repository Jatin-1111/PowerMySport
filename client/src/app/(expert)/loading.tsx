import { RouteLoading } from "@/components/layout/RouteFallbacks";

/**
 * Streaming fallback for this route group. Next.js requires a per-segment file,
 * so this is a thin wrapper around the shared surface.
 */
export default function Loading() {
  return <RouteLoading label="Loading your console…" />;
}
