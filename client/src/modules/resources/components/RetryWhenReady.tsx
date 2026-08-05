// ─── Self-checking retry ────────────────────────────────────────────────────
//
// Re-renders the page on a timer while a sport×state pair is being generated.
//
// `router.refresh()` and not a full reload: the failed attempt cached nothing, so
// the next server render re-fetches for real, and a soft refresh keeps the
// reader's scroll position and the panel's own state.
//
// Bounded attempts. Generation can fail outright (Gemini unavailable, an
// unsupported pair), and a page that reloads itself forever is worse than one that
// admits it didn't work and hands over a button.

"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Long enough that a check is likely to find the pathway finished. */
const INTERVAL_SECONDS = 20;
const MAX_ATTEMPTS = 3;

export function RetryWhenReady() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const [countdown, setCountdown] = useState(INTERVAL_SECONDS);

  // One effect per attempt: a ticker for the visible countdown and a single timer
  // that does the refresh. The refresh deliberately does not hang off the
  // countdown reaching zero — `router.refresh()` from inside a state updater runs
  // during render, which React rejects outright.
  useEffect(() => {
    if (attempt >= MAX_ATTEMPTS) return;
    const ticker = setInterval(
      () => setCountdown((c) => Math.max(0, c - 1)),
      1000,
    );
    const retry = setTimeout(() => {
      setAttempt((a) => a + 1);
      setCountdown(INTERVAL_SECONDS);
      // The page this component sits on only renders while the pathway is
      // missing, so a refresh that finds it finished replaces the page and
      // unmounts the timer.
      router.refresh();
    }, INTERVAL_SECONDS * 1000);
    return () => {
      clearInterval(ticker);
      clearTimeout(retry);
    };
  }, [attempt, router]);

  const exhausted = attempt >= MAX_ATTEMPTS;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      {exhausted ? (
        <>
          <p className="text-sm font-semibold leading-relaxed text-amber-900">
            Still not ready. It may need another minute, or this pair may have
            failed to generate.
          </p>
          <button
            type="button"
            onClick={() => {
              setAttempt(0);
              setCountdown(INTERVAL_SECONDS);
              router.refresh();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Check again
          </button>
        </>
      ) : (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm font-semibold text-amber-900"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking again in {countdown}s — no need to reload.
        </p>
      )}
    </div>
  );
}
