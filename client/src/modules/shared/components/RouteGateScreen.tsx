"use client";

/**
 * Placeholder rendered while a route guard is resolving or redirecting.
 *
 * The point is what it does NOT render: none of the console chrome, nav, or
 * children. A signed-out visitor to a protected route sees this for a frame
 * instead of a dashboard they cannot use.
 */
export function RouteGateScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}
