"use client";

// ─── Guide call-to-action ───────────────────────────────────────────────────
//
// Sits under the stage reader.
//
// The reader answers "what happens at each stage, and what does it cost". What
// it deliberately does not carry is the long-form detail — which academies near
// you, which schemes, what racquet, how to judge a coach — so the space is spent
// pointing at that once, unmissably.
//
// Contextual when it can be: it deep-links to the stage the parent is reading,
// so they land where they were looking rather than at the top of a long page.

import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

export function GuideCallout({
  href,
  sportName,
  stageLabel,
}: {
  href: string;
  sportName: string;
  /** The selected rung, when one is selected and the link is deep. */
  stageLabel?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-3xl border-2 border-power-orange/30 bg-gradient-to-br from-orange-50 via-white to-white p-5 shadow-sm transition hover:border-power-orange hover:shadow-md sm:flex-row sm:items-center sm:gap-5 sm:p-6"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-power-orange text-white shadow-sm">
        <BookOpen className="h-6 w-6" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black uppercase tracking-widest text-power-orange">
          The written guide
        </span>
        <span className="mt-0.5 block text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">
          {stageLabel
            ? `Everything about ${stageLabel}`
            : `The complete parent's guide to ${sportName.toLowerCase()}`}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-slate-600">
          Ages and costs stage by stage, which academies near you, the schemes that
          help pay, how to judge a coach — and what a career looks like if they
          don&apos;t turn pro.
        </span>
      </span>

      <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition group-hover:bg-power-orange sm:self-auto">
        Read the guide
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
