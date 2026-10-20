import { cn } from "@/utils/cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import React from "react";
import { HOW_STEPS, type HowStep } from "../../data/howItWorksSteps";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * Server-rendered options for the homepage "How it works" band, from the 20 Oct
 * review's five steps. The layouts that need script (the stepper and the scroll story)
 * are in HowItWorksInteractive.tsx, and the conversation is JourneySteps itself.
 *
 *  A  Five ruled columns.
 *  B  A staircase, one hairline running along every step and down every riser.
 *  E  Each step beside a small specimen of what the parent sees at that step.
 *  G  An asymmetric bento of cards, which swipes sideways on a phone.
 */

function Header({ className }: { className?: string }) {
  return (
    <div className={cn("reveal-on-scroll max-w-3xl", className)}>
      <SectionKicker label="How it works" />
      <h2 className={SECTION_HEADING}>From questions to action</h2>
    </div>
  );
}

const SQUARE_TAG =
  "border-ink/25 text-ink-muted inline-block rounded-sm border px-1.5 py-0.5 text-xs font-medium";

// ─── A: five ruled columns ──────────────────────────────────────────────────

export function HowColumns() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="reveal-on-scroll mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 xl:grid-cols-5">
          {HOW_STEPS.map((step, index) => (
            <li key={step.title} className="border-ink/20 border-t pt-6">
              <span className="font-editorial text-ink mb-10 block text-5xl font-light tabular-nums">
                {index + 1}
              </span>
              <h3 className="text-ink mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-ink-body max-w-[32ch] text-pretty leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── B: a staircase ─────────────────────────────────────────────────────────

const STAIR = ["", "xl:mt-8", "xl:mt-16", "xl:mt-24", "xl:mt-32"] as const;

export function HowStaircase() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 xl:grid-cols-5 xl:gap-x-0 xl:gap-y-0">
          {HOW_STEPS.map((step, index) => (
            <li
              key={step.title}
              className={cn(
                "reveal-on-scroll border-ink/25 relative border-t pt-8 xl:pr-8",
                "before:bg-ink before:absolute before:-top-[5px] before:left-0 before:h-[9px] before:w-[9px] before:rounded-[2px] before:content-['']",
                index < HOW_STEPS.length - 1 &&
                  "xl:after:bg-ink/25 xl:after:absolute xl:after:-top-px xl:after:right-0 xl:after:h-8 xl:after:w-px xl:after:content-['']",
                STAIR[index]
              )}
            >
              <span className="font-editorial text-ink mb-8 block text-6xl font-light tabular-nums leading-none">
                {index + 1}
              </span>
              <h3 className="text-ink mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-ink-body max-w-[30ch] text-pretty leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
        <div aria-hidden className="hidden xl:block xl:h-4" />
      </div>
    </section>
  );
}

// ─── E: each step beside what the parent sees ───────────────────────────────

/** A small framed specimen for each step. Invented, and labelled where it shows an example. */
function Specimen({ index, step }: { index: number; step: HowStep }) {
  const frame = "border-hairline rounded-2xl border bg-white p-5 sm:p-6";

  if (index === 0) {
    return (
      <div className={frame}>
        <p className="text-ink-muted mb-3 text-sm font-medium">{step.listLabel}</p>
        <ul className="border-hairline border-t">
          {step.items.map((item) => (
            <li
              key={String(item)}
              className="border-hairline text-ink flex items-center justify-between gap-4 border-b py-3.5 text-base leading-snug"
            >
              {String(item)}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="text-ink-muted h-4 w-4 shrink-0"
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className={frame}>
        <p className="text-ink-muted mb-4 text-sm font-medium">What we ask about</p>
        <div className="flex flex-wrap gap-2">
          {["Age", "Sport", "Level", "Years played", "Goal", "Time", "Budget", "Travel"].map(
            (label) => (
              <span
                key={label}
                className="border-ink/20 text-ink rounded-md border px-3 py-1.5 text-sm font-medium"
              >
                {label}
              </span>
            )
          )}
        </div>
        <p className="text-ink-muted mt-5 text-sm leading-snug">
          Asked in the assessment, the guidance form, the season planner and by our team on
          WhatsApp.
        </p>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className={frame}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-ink-muted text-sm font-medium">Next step</p>
          <span className={SQUARE_TAG}>Example</span>
        </div>
        <p className="font-editorial text-ink text-2xl font-light leading-tight">
          District Junior Open, Pune
        </p>
        <ul className="border-hairline mt-4 border-t">
          {["Fits her age and level", "Under two hours from home", "Entries close in 6 days"].map(
            (line) => (
              <li
                key={line}
                className="border-hairline text-ink border-b py-3 text-base leading-snug"
              >
                {line}
              </li>
            )
          )}
        </ul>
      </div>
    );
  }

  if (index === 3) {
    return (
      <div className={frame}>
        <p className="text-ink-muted mb-3 text-sm font-medium">{step.listLabel}</p>
        <ul className="border-hairline border-t">
          {step.items.map((item) =>
            typeof item === "string" ? null : (
              <li key={item.label} className="border-hairline border-b">
                <Link
                  href={item.href}
                  className="text-ink hover:bg-paper-deep/60 focus-visible:ring-ink group -mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3.5 text-base leading-snug transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
                >
                  {item.label}
                  <ArrowRight
                    aria-hidden
                    strokeWidth={1.5}
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </Link>
              </li>
            )
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className={frame}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-ink-muted text-sm font-medium">Anaya&apos;s journey</p>
        <span className={SQUARE_TAG}>Example</span>
      </div>
      <ul className="border-hairline border-t">
        {["Chose tennis", "Shortlisted the District Junior Open", "Check-in due in four weeks"].map(
          (line, i) => (
            <li
              key={line}
              className={cn(
                "border-hairline text-ink border-b py-3 text-base leading-snug",
                i === 2 && "border-l-power-orange-solid border-l-2 pl-3 font-semibold"
              )}
            >
              {line}
            </li>
          )
        )}
      </ul>
    </div>
  );
}

export function HowSpecimens() {
  return (
    <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="mt-12 lg:mt-16">
          {HOW_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="reveal-on-scroll border-ink/20 grid gap-6 border-t py-10 lg:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,26rem)] lg:gap-12 lg:py-12"
            >
              <span className="font-editorial text-ink text-5xl font-light tabular-nums leading-none lg:text-6xl">
                {index + 1}
              </span>
              <div>
                <h3 className="text-ink mb-3 text-xl font-semibold">{step.title}</h3>
                <p className="text-ink-body max-w-[40ch] text-pretty text-lg leading-relaxed">
                  {step.body}
                </p>
              </div>
              <Specimen index={index} step={step} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── G: an asymmetric bento, swiping on a phone ─────────────────────────────

const BENTO_SPAN = [
  "lg:col-span-2",
  "lg:col-span-4",
  "lg:col-span-4",
  "lg:col-span-2",
  "lg:col-span-6",
] as const;

const BENTO_TONE = ["bg-white", "bg-paper-deep", "bg-paper-deep", "bg-white", "bg-white"] as const;

export function HowBento() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="hide-scrollbar reveal-on-scroll -mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:mt-16 lg:grid lg:grid-cols-6 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
          {HOW_STEPS.map((step, index) => (
            <li
              key={step.title}
              className={cn(
                "border-hairline flex min-w-[82%] snap-center flex-col rounded-2xl border p-6 sm:min-w-[24rem] sm:p-8 lg:min-w-0",
                BENTO_TONE[index],
                BENTO_SPAN[index]
              )}
            >
              <span className="font-editorial text-ink mb-6 block text-6xl font-light tabular-nums leading-none">
                {index + 1}
              </span>
              <h3 className="text-ink mb-2 text-xl font-semibold">{step.title}</h3>
              <p className="text-ink-body max-w-[44ch] text-pretty leading-relaxed">{step.body}</p>

              <ul
                className={cn(
                  "text-ink border-ink/15 mt-6 border-t pt-4 text-sm leading-snug",
                  index === 4 ? "grid gap-x-8 gap-y-2 sm:grid-cols-3" : "space-y-2"
                )}
              >
                {step.items.slice(0, index === 4 ? 3 : 3).map((item) => (
                  <li key={typeof item === "string" ? item : item.label}>
                    {typeof item === "string" ? (
                      item
                    ) : (
                      <Link
                        href={item.href}
                        className="decoration-ink/30 hover:decoration-ink underline underline-offset-4"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
