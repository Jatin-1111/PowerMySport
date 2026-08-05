// ─── Hero ───────────────────────────────────────────────────────────────────
//
// The first screen has one job: tell a parent who has never seen this page what
// it covers and how long the journey is, before they decide whether to read on.
//
// The stat strip is the part that does the work. "Four stages, ages 5 to 18" is
// the single most useful thing a parent can learn in two seconds, and it used to
// be discoverable only by scrolling the whole article.

import { MapPin, Route } from "lucide-react";
import Link from "next/link";

export function ResourceHero({
  sportName,
  state,
  overview,
  stats,
}: {
  sportName: string;
  state: string;
  overview?: string;
  stats: Array<{ label: string; value: string }>;
}) {
  return (
    <header className="border-b border-slate-200 bg-gradient-to-b from-orange-50/70 via-white to-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="max-w-3xl">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-widest text-power-orange">
            Parent&apos;s guide
            <span className="text-slate-300">/</span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <MapPin className="h-3 w-3" />
              {state}
            </span>
          </p>

          <h1 className="mt-2 text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-[2.75rem]">
            {sportName} in India,
            <span className="block text-slate-400">stage by stage</span>
          </h1>

          {overview && (
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              {overview}
            </p>
          )}

          <Link
            href={`/roadmap?sport=${encodeURIComponent(sportName)}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-700"
          >
            <Route className="h-4 w-4" />
            See every route as a map
          </Link>
        </div>

        {/* The journey in numbers. Stated as label-over-value so it scans as a
            dashboard rather than a sentence. */}
        {stats.length > 0 && (
          <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white px-4 py-4">
                <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {s.label}
                </dt>
                <dd className="mt-1 text-lg font-extrabold leading-tight text-slate-900">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}
