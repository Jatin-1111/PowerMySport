// ─── State switcher ─────────────────────────────────────────────────────────
//
// Picking a state applies immediately. Everything below the picker — academies,
// facilities, registration bodies, fee bands, scheme criteria, the tier labels
// themselves — is generated per sport×state, so the control has to feel like it
// changes the page, because it does.
//
// It used to be a bare GET form with an "Update" button: choosing a state and
// then not noticing the button read as a dead control, which is the bug this
// replaces. Now the change navigates on `change`, and the reader gets a pending
// bar while the server re-renders (a cold sport×state pair takes seconds, so
// silent waiting is not an option).
//
// Still a real `<form method="GET">` underneath, so the URL remains the whole
// state of the page — shareable, back-button-correct, and functional without
// JavaScript via the `<noscript>` submit button. What is deliberately NOT here is
// a grid of 28 links per sport: that hands search engines several hundred URLs
// differing by one list, the thin-content pattern this site was flagged for. The
// page canonicalises every `?state=` back to the bare path.

"use client";

import { Loader2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";

import { INDIAN_STATES_AND_UTS } from "@/lib/indianStates";

export function StateSwitcher({
  sportSlug,
  state,
  compact = false,
}: {
  sportSlug: string;
  state: string;
  /** In the sidebar the label lives outside, so the control drops its own. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Shows the reader's pick the instant they make it, then defers to the prop
  // once the server render lands. A plain `defaultValue` would go stale on a back
  // navigation; a plain `value={state}` would snap back to the old state for the
  // seconds the fetch takes.
  const [shownState, setShownState] = useOptimistic(state);

  function goTo(next: string) {
    if (!next || next === state) return;
    startTransition(() => {
      setShownState(next);
      // `scroll: false` — a reader who switches state 2,000px into the article
      // wants the same stage in a different state, not the top of the page.
      router.push(`/resources/${sportSlug}?state=${encodeURIComponent(next)}`, {
        scroll: false,
      });
    });
  }

  return (
    <form
      action={`/resources/${sportSlug}`}
      method="GET"
      onSubmit={(e) => {
        e.preventDefault();
        goTo(new FormData(e.currentTarget).get("state") as string);
      }}
      className={
        compact
          ? "space-y-2"
          : "flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-3"
      }
    >
      {/* Pinned to the viewport rather than sitting inside the rail: the picker
          scrolls out of view on a long article, and progress the reader can't see
          is the same as no progress. */}
      {isPending && (
        <div
          aria-hidden
          className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-power-orange"
        />
      )}

      {!compact && (
        <label
          htmlFor="resource-state"
          className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400"
        >
          <MapPin className="h-3.5 w-3.5" />
          Local detail for
        </label>
      )}

      {/* No "All of India" option. `GET /pathways` refuses a request without a
          state, so the option would silently fall back to the default and show
          one state's academies under a national label — worse than not offering
          it. It comes back when `SportBasePath` is populated and there is
          genuinely state-independent content to show. */}
      <select
        id="resource-state"
        name="state"
        value={shownState}
        onChange={(e) => goTo(e.target.value)}
        disabled={isPending}
        aria-label="State"
        className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 ${
          compact ? "w-full" : "flex-1"
        }`}
      >
        {INDIAN_STATES_AND_UTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Present even when idle so the announcement is a live-region update rather
          than new content appearing, but out of the layout until there is
          something to say — the surrounding labels already name the state. */}
      <p
        role="status"
        aria-live="polite"
        className={
          isPending
            ? `flex items-center gap-1.5 text-[11px] font-bold text-power-orange ${
                compact ? "" : "basis-full"
              }`
            : "sr-only"
        }
      >
        {isPending && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading {shownState} detail…
          </>
        )}
      </p>

      {/* Only reachable with JavaScript off, where `change` can't navigate. Set
          as markup rather than children because a browser with scripting enabled
          parses <noscript> content as text, which React would fail to hydrate. */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<button type="submit" class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white${
            compact ? " w-full" : ""
          }">Update</button>`,
        }}
      />
    </form>
  );
}
