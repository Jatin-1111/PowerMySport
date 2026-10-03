"use client";

import { cn } from "@/utils/cn";
import { CalendarCheck } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { SectionLabel } from "./SectionLabel";

export interface ShowcaseFeature {
  title: string;
  description: string;
  icon?: React.ReactNode;
  label?: string;
  stat?: string;
  /** Which illustration to show: "roadmap", "steps", "chat" or "trial". */
  visual?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export interface FeatureTrack {
  key: string;
  label: string;
  features: ShowcaseFeature[];
}

interface FeaturesShowcaseProps {
  title?: string;
  subtitle?: string;
  description?: string;
  /** Single-track mode — renders the walkthrough directly with no track toggle. */
  features?: ShowcaseFeature[];
  /** Multi-track mode — renders a toggle above the walkthrough to switch feature sets. */
  tracks?: FeatureTrack[];
}

/**
 * The homepage walkthrough, driven by the reader's own scroll.
 *
 * It used to be a carousel that advanced itself every five seconds and paused
 * only under a mouse, so on a phone nobody could stop it. Now the steps are
 * ordinary content in the page's own scroll. On a wide screen the illustration
 * column pins with CSS `sticky` and shows whichever step is at the middle of
 * the viewport; the others dim so the reader can see where they are. On a
 * phone each step simply carries its illustration inline.
 *
 * Deliberately not Aceternity's StickyScroll, which scrolls inside a fixed-height
 * box of its own: a second scrollbar inside the page is a trap on a phone.
 */

const pad = (n: number) => String(n).padStart(2, "0");

// ─── Illustrations ────────────────────────────────────────────────────────────
// Small product sketches in plain JSX. One brand accent throughout; they used to
// cycle orange, blue, teal and emerald per step.

const ACCENT = "bg-power-orange-solid";

function RoadmapSketch() {
  const nodes = ["Age 7", "Age 9", "Age 11", "Compete"];
  return (
    <div className="flex items-center gap-2">
      {nodes.map((node, i) => (
        <React.Fragment key={node}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold",
                i === 0 ? cn(ACCENT, "text-white") : "bg-slate-100 text-slate-500"
              )}
            >
              {i + 1}
            </div>
            <span className="text-xs text-slate-500">{node}</span>
          </div>
          {i < nodes.length - 1 && (
            <div className="mb-6 h-px flex-1 border-t border-dashed border-slate-300" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function StepsSketch() {
  const steps = ["First session", "Build basics", "Join a team", "First tournament"];
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={step} className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              i === 0 ? cn(ACCENT, "text-white") : "bg-slate-200 text-slate-500"
            )}
          >
            {i + 1}
          </span>
          <span className={cn("h-1.5 flex-1 rounded-full", i === 0 ? ACCENT : "bg-slate-100")} />
          <span
            className={cn("text-xs", i === 0 ? "font-semibold text-slate-700" : "text-slate-500")}
          >
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ChatSketch() {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="ml-auto max-w-[80%] rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
        Is tennis right for my 8-year-old?
      </p>
      <p className="max-w-[80%] rounded-lg bg-orange-50 px-3 py-2 text-xs font-medium text-orange-900">
        Yes. Here&apos;s a personalised 3-month plan.
      </p>
    </div>
  );
}

function TrialSketch() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white",
            ACCENT
          )}
        >
          <CalendarCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">Trial session booked</p>
          <p className="text-xs text-slate-500">Saturday, 10:00 AM</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["Sport matched", "Screening done", "Trial booked"].map((label) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-md border border-slate-200 px-2 py-2.5"
          >
            <span className={cn("h-2 w-2 rounded-full", ACCENT)} />
            <span className="text-center text-[11px] font-medium text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SKETCHES: Record<string, React.FC> = {
  roadmap: RoadmapSketch,
  steps: StepsSketch,
  chat: ChatSketch,
  trial: TrialSketch,
};

function Sketch({
  feature,
  step,
  total,
}: {
  feature: ShowcaseFeature;
  step: number;
  total: number;
}) {
  const Drawing = (feature.visual && SKETCHES[feature.visual]) || RoadmapSketch;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4 text-xs font-semibold">
        <span className="text-slate-700">{feature.title}</span>
        <span className="tabular-nums text-slate-400">
          {pad(step + 1)} / {pad(total)}
        </span>
      </div>
      <Drawing />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const FeaturesShowcase: React.FC<FeaturesShowcaseProps> = ({
  title,
  subtitle,
  description,
  features: singleFeatures,
  tracks,
}) => {
  const [trackIdx, setTrackIdx] = useState(0);
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLLIElement | null>>([]);

  const features = tracks ? tracks[trackIdx].features : (singleFeatures ?? []);

  // The step crossing the middle of the viewport is the active one. A zero-
  // height band at 50% means exactly one step can be "in" it at a time.
  useEffect(() => {
    const steps = stepRefs.current.filter((el): el is HTMLLIElement => el !== null);
    if (steps.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-50% 0px -50% 0px" }
    );
    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, [trackIdx, features.length]);

  const chooseTrack = (index: number) => {
    setTrackIdx(index);
    setActive(0);
  };

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(title || subtitle || description) && (
          <div className="reveal-on-scroll mb-10 sm:mb-12">
            {subtitle && (
              <div className="mb-4">
                <SectionLabel label={subtitle} color="orange" />
              </div>
            )}
            {title && (
              <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {description}
              </p>
            )}
          </div>
        )}

        {tracks && tracks.length > 1 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Where you are starting">
            {tracks.map((track, i) => (
              <button
                key={track.key}
                type="button"
                aria-pressed={i === trackIdx}
                onClick={() => chooseTrack(i)}
                className={cn(
                  "btn-motion rounded-md border px-4 py-2 text-sm font-semibold",
                  i === trackIdx
                    ? "border-power-orange-solid text-power-orange-solid bg-orange-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                {track.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 lg:mt-0 lg:grid lg:grid-cols-2 lg:gap-16">
          {/* Room under the last step on a wide screen, so the pinned illustration
              is still pinned when that step reaches the middle of the viewport. */}
          <ol key={trackIdx} className="lg:pb-[20vh]">
            {features.map((feature, i) => (
              <li
                key={feature.title}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                data-step={i}
                className="border-t border-slate-200 py-8 first:border-t-0 lg:flex lg:min-h-[60vh] lg:items-center lg:border-t-0 lg:py-0"
              >
                <div
                  className={cn(
                    "transition-opacity duration-300 motion-reduce:transition-none",
                    i === active ? "lg:opacity-100" : "lg:opacity-40"
                  )}
                >
                  <p className="text-power-orange-solid text-sm font-semibold">
                    <span className="tabular-nums">{pad(i + 1)}</span>
                    {feature.label && (
                      <span className="text-slate-500"> · &ldquo;{feature.label}&rdquo;</span>
                    )}
                  </p>
                  <h3 className="font-title mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-3 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                    {feature.description}
                  </p>
                  {feature.stat && (
                    <p className="mt-4 text-sm font-medium text-slate-500">{feature.stat}</p>
                  )}
                  {/* On a phone the illustration sits with its step. */}
                  <div className="mt-6 lg:hidden" aria-hidden>
                    <Sketch feature={feature} step={i} total={features.length} />
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* On a wide screen one pinned illustration follows the reader. The
              steps carry the meaning, so the sketches are hidden from screen
              readers rather than announced twice. */}
          <div className="hidden lg:block" aria-hidden>
            <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center">
              <div className="grid w-full">
                {features.map((feature, i) => (
                  <div
                    key={feature.title}
                    className={cn(
                      "transition duration-300 [grid-area:1/1] motion-reduce:transition-none",
                      i === active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                    )}
                  >
                    <Sketch feature={feature} step={i} total={features.length} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
