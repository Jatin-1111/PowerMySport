"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  IndianRupee,
  Minus,
  ThumbsUp,
} from "lucide-react";
import type { SportFitResult, WizardAnswers } from "../../types";
import { ChooseSportButton } from "./ChooseSportButton";

// ─── Fit tone ────────────────────────────────────────────────────────────────
// One tone per fit band, reused across the score rail, the bar and the badge
// so the card reads at a glance before a single line of text is processed.

type Tone = {
  bar: string;
  text: string;
  badge: string;
  tile: string;
  rail: string;
};

function toneFor(score: number, hasBlocker: boolean): Tone {
  // A hard blocker outranks the number: a 90-scoring sport the family can't
  // afford shouldn't be painted green.
  if (hasBlocker) {
    return {
      bar: "bg-amber-500",
      text: "text-amber-600",
      badge: "bg-amber-100/70 text-amber-700",
      tile: "bg-amber-50 text-amber-600",
      rail: "bg-amber-50/70",
    };
  }
  if (score >= 88) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-600",
      badge: "bg-emerald-100/70 text-emerald-700",
      tile: "bg-emerald-50 text-emerald-600",
      rail: "bg-emerald-50/70",
    };
  }
  if (score >= 70) {
    return {
      bar: "bg-power-orange",
      text: "text-power-orange",
      badge: "bg-orange-100/70 text-orange-700",
      tile: "bg-orange-50 text-power-orange",
      rail: "bg-orange-50/70",
    };
  }
  return {
    bar: "bg-slate-400",
    text: "text-slate-500",
    badge: "bg-slate-200/70 text-slate-600",
    tile: "bg-slate-100 text-slate-500",
    rail: "bg-slate-50",
  };
}

export function SportFitCard({
  fit,
  answers,
  eyebrow,
  chosen,
  saving,
  onChoose,
}: {
  fit: SportFitResult;
  answers: WizardAnswers;
  /** Position label. Never an ordinal of the parent's pick order — the cards are
   *  sorted by score, so a "#2" beside a higher number than the "#3" below it
   *  read as a bug. */
  eyebrow: string;
  chosen: boolean;
  saving: boolean;
  onChoose: (sport: string) => void;
}) {
  const name = answers.childName || "Your child";
  const tone = toneFor(fit.score, fit.hasBlocker);

  return (
    <article
      className={`overflow-hidden rounded-2xl bg-white transition-shadow ${
        chosen
          ? "border-turf-green shadow-turf-green/10 border-2 shadow-md"
          : "border border-slate-200 shadow-sm"
      }`}
    >
      {/* ── Header: score rail + identity ──
          The score sits directly beside the sport name rather than floating at
          the far edge of a wide row — at desktop widths those two were reading
          as unrelated blocks. */}
      <div className="flex flex-col sm:flex-row">
        {/* Score rail */}
        <div
          className={`flex shrink-0 items-center gap-4 border-b border-slate-100 px-5 py-4 sm:w-[150px] sm:flex-col sm:justify-center sm:gap-2 sm:border-b-0 sm:border-r sm:px-4 sm:py-6 ${tone.rail}`}
        >
          <div className="flex items-baseline gap-1">
            <span
              className={`font-title text-4xl font-bold tabular-nums leading-none ${tone.text}`}
            >
              {fit.score}
            </span>
            <span className="text-xs font-medium text-slate-400">/ 100</span>
          </div>
          <span
            className={`ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:ml-0 ${tone.badge}`}
          >
            {fit.hasBlocker ? "Needs a fix first" : fit.fitLabel}
          </span>
          <div className="ml-auto hidden h-1.5 w-full overflow-hidden rounded-full bg-white/70 sm:ml-0 sm:mt-1 sm:block">
            <div
              className={`h-full rounded-full transition-all duration-700 ${tone.bar}`}
              style={{ width: `${fit.score}%` }}
            />
          </div>
        </div>

        {/* Identity + practicals */}
        <div className="min-w-0 flex-1 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.tile}`}
            >
              <span className="text-lg font-bold">{fit.sport.name[0]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {eyebrow}
              </p>
              <h3 className="font-title text-lg font-bold leading-tight text-slate-900">
                {fit.sport.name}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">{fit.sport.tagline}</p>
            </div>
          </div>

          {/* Practicals live in the header now — they used to sit in a separate
              footer strip, which added a third horizontal rule per card. */}
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 pt-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <IndianRupee className="h-3.5 w-3.5 text-slate-300" />
              {fit.sport.costRange}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-300" />
              {fit.sport.minWeeklyHours}+ hrs/week to progress
            </span>
          </div>
        </div>
      </div>

      {/* ── Two-sided breakdown ──
          Untinted on purpose: the two lists are rarely the same length, and any
          fill turned the shorter column's leftover space into a visible hole.
          Plain whitespace under a short list reads as breathing room. */}
      <div className="grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Where they fit */}
        <div className="px-5 py-4 sm:px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100/70">
              <ThumbsUp className="h-3 w-3 text-emerald-600" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Where {name} fits
            </p>
          </div>
          <ul className="space-y-2.5">
            {fit.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100/70">
                  <Check className="h-2.5 w-2.5 text-emerald-600" />
                </div>
                <p className="text-[13px] leading-relaxed text-slate-600">{s}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Where they don't */}
        <div className="px-5 py-4 sm:px-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100/70">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Where it&apos;ll be harder
            </p>
          </div>

          {fit.gaps.length > 0 ? (
            <ul className="space-y-2.5">
              {fit.gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100/70">
                    <Minus className="h-2.5 w-2.5 text-amber-600" />
                  </div>
                  <p className="text-[13px] leading-relaxed text-slate-600">{g}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100/70">
                <Check className="h-2.5 w-2.5 text-emerald-600" />
              </div>
              <p className="text-[13px] leading-relaxed text-slate-600">
                Nothing in {name}&apos;s profile works against {fit.sport.name} — no mismatch big
                enough to flag. A trial class is the only thing left to check.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── The decision ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 sm:px-6">
        <p className="text-xs text-slate-400">
          {chosen ? (
            <span className="text-turf-green inline-flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Your trial booking and follow-ups will use {fit.sport.name}
            </span>
          ) : (
            "Decided? Tell us and we'll set the trial up in this sport."
          )}
        </p>
        <ChooseSportButton
          sportName={fit.sport.name}
          chosen={chosen}
          saving={saving}
          onChoose={onChoose}
        />
      </div>
    </article>
  );
}
