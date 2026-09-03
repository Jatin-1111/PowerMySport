"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Quote } from "lucide-react";
import {
  istDateLabel,
  msUntilNextIstMidnight,
  quoteForDay,
  type DailyQuote,
} from "@/modules/community/data/dailyQuotes";

/**
 * One quote per IST calendar day, picked deterministically from the day number
 * so every visitor sees the same line on the same day.
 *
 * The clock is read in an effect rather than during render: the repo's
 * react-hooks purity rule (rightly) rejects `Date.now()` in render, and it also
 * keeps the pick out of any cached HTML — a page held in a CDN for a week would
 * otherwise serve last week's quote. A timer re-picks at the next IST midnight
 * so a tab left open overnight rolls over on its own.
 */
export default function QuoteOfTheDay() {
  const reduceMotion = useReducedMotion();
  const [today, setToday] = useState<{
    quote: DailyQuote;
    label: string;
  } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const apply = () => {
      const now = Date.now();
      setToday({ quote: quoteForDay(now), label: istDateLabel(now) });
      // +1s of slack so the timer never fires a hair before midnight and
      // re-picks the day it just left.
      timer = setTimeout(apply, msUntilNextIstMidnight(now) + 1000);
    };

    apply();
    return () => clearTimeout(timer);
  }, []);

  const initials = today
    ? today.quote.author
        .split(" ")
        .filter((part) => /[A-Za-z]/.test(part))
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "";

  return (
    <figure className="group relative flex h-full min-h-52 flex-col overflow-hidden rounded-[1.4rem] bg-white/80 p-5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 backdrop-blur-md sm:p-6">
      {/* Depth, in three cheap layers: a warm corner glow, a cool one on the
          opposite side, and a hairline highlight along the top edge so the
          card reads as glass rather than a flat white box. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(233,115,22,0.22),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.20),transparent_66%)] blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
      />
      <Quote
        aria-hidden="true"
        strokeWidth={1.25}
        className="pointer-events-none absolute top-3 -right-4 h-24 w-24 rotate-6 text-slate-900/[0.045] transition-transform duration-500 group-hover:rotate-0"
      />

      <figcaption className="relative flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-slate-500 uppercase">
          <span className="text-power-orange flex h-6 w-6 items-center justify-center rounded-lg bg-[linear-gradient(135deg,rgba(233,115,22,0.16),rgba(245,158,11,0.2))]">
            <Quote size={12} aria-hidden="true" />
          </span>
          Quote of the day
        </span>
        {today && (
          <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-500 tabular-nums">
            {today.label} · IST
          </span>
        )}
      </figcaption>

      <div className="relative mt-4 flex flex-1 flex-col justify-center">
        {today ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.blockquote
              key={today.quote.text}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <p className="font-title text-[1.15rem] leading-snug font-medium tracking-tight text-pretty text-slate-900 sm:text-[1.35rem]">
                <span
                  aria-hidden="true"
                  className="mr-0.5 bg-[linear-gradient(120deg,#E97316,#F59E0B)] bg-clip-text align-text-top text-2xl leading-none font-bold text-transparent sm:text-3xl"
                >
                  &ldquo;
                </span>
                {today.quote.text}
                <span
                  aria-hidden="true"
                  className="ml-0.5 bg-[linear-gradient(120deg,#F59E0B,#E97316)] bg-clip-text align-text-bottom text-2xl leading-none font-bold text-transparent sm:text-3xl"
                >
                  &rdquo;
                </span>
              </p>

              <footer className="mt-4 flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a,#334155)] text-[11px] font-bold tracking-wide text-white shadow-sm"
                >
                  {initials}
                </span>
                <cite className="min-w-0 truncate text-sm font-semibold text-slate-900 not-italic">
                  {today.quote.author}
                </cite>
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        ) : (
          // Placeholder sized like the real thing so the panel does not jump
          // between the first paint and the effect.
          <div aria-hidden="true" className="animate-pulse">
            <div className="h-5 w-full rounded-full bg-slate-200/70" />
            <div className="mt-2.5 h-5 w-4/5 rounded-full bg-slate-200/70" />
            <div className="mt-4 flex items-center gap-2.5">
              <div className="h-8 w-8 flex-none rounded-full bg-slate-200/70" />
              <div className="h-3.5 w-28 rounded-full bg-slate-200/70" />
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
