"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

/**
 * Shared route-level loading and error surfaces.
 *
 * There were no `loading.tsx` or `error.tsx` files anywhere in the app, which
 * meant two things had no defined shape: what a route shows while its server
 * work is in flight, and what it shows when that work throws. Without a
 * `loading` boundary a slow segment simply blocks; without an `error` boundary a
 * throw escapes to the root and takes the whole page down rather than the part
 * that failed.
 *
 * These are deliberately plain. A route-level fallback should read as the page
 * arriving, not as a separate designed screen competing with it.
 */

export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="border-power-orange h-8 w-8 animate-spin rounded-full border-3 border-t-transparent" />
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function RouteError({
  reset,
  title = "Something went wrong",
  description = "This section failed to load. Trying again usually fixes it.",
  homeHref = "/",
}: {
  reset: () => void;
  title?: string;
  description?: string;
  homeHref?: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="bg-power-orange inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Go back
          </Link>
        </div>
      </div>
    </div>
  );
}
