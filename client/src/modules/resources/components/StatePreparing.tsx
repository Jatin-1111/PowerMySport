// ─── State not ready yet ────────────────────────────────────────────────────
//
// What a reader gets when they pick a state whose guide hasn't been generated.
//
// The API generates an uncached sport×state pair inline, on the request that asks
// for it, and that takes longer than a page render should wait. The page bounds
// its fetch and used to answer `notFound()` — so switching to, say, Mizoram threw
// away the article and replaced it with a 404, which reads as the switcher being
// broken rather than as content still being built.
//
// The generation the abandoned request kicked off does complete server-side, so
// the honest answer is "come back in a moment" — and since it will be ready in a
// moment, the panel checks for itself instead of asking the reader to.

import { MapPin, Route } from "lucide-react";
import Link from "next/link";

import { RetryWhenReady } from "./RetryWhenReady";
import { StateSwitcher } from "./StateSwitcher";

export function StatePreparing({
  sportSlug,
  sportName,
  state,
  defaultState,
}: {
  sportSlug: string;
  sportName: string;
  state: string;
  /** The state that is known to have a guide, for the way out. */
  defaultState: string;
}) {
  return (
    <div className="bg-slate-50/60">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-power-orange">
          Parent&apos;s guide
          <span className="text-slate-300">/</span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <MapPin className="h-3 w-3" />
            {state}
          </span>
        </p>

        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
          Building the {state} guide to {sportName}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-slate-600">
          Nobody has asked for {sportName} in {state} before, so we&apos;re
          researching it now — the academies, the state association, what a season
          costs there and which schemes apply. It takes about a minute the first
          time, and it&apos;s instant for everyone after.
        </p>

        <RetryWhenReady />

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <MapPin className="h-3 w-3" />
            Or read a different state
          </p>
          <StateSwitcher sportSlug={sportSlug} state={state} compact />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/resources/${sportSlug}?state=${encodeURIComponent(defaultState)}`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            Read the {defaultState} guide
          </Link>
          <Link
            href={`/roadmap?sport=${encodeURIComponent(sportName)}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Route className="h-4 w-4" />
            See every route as a map
          </Link>
        </div>
      </div>
    </div>
  );
}
