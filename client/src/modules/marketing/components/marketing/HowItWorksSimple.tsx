import { cn } from "@/utils/cn";
import React from "react";
import { HOW_STEPS } from "../../data/howItWorksSteps";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * The plainest "How it works" options: the five titles and the review's one-line
 * descriptions, and nothing else. No cards, no examples, no lists.
 *
 *  L  A contents page: big titles down the left, the line beside each.
 *  M  One line with five stops, titles above and the line under each.
 *  N  The five titles read as one large sentence, the lines in small type below.
 */

function Header() {
  return (
    <div className="reveal-on-scroll max-w-3xl">
      <SectionKicker label="How it works" />
      <h2 className={SECTION_HEADING}>From questions to action</h2>
    </div>
  );
}

// ─── L: a contents page ─────────────────────────────────────────────────────

export function HowContents() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="mt-12 lg:mt-16">
          {HOW_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="reveal-on-scroll border-ink/15 grid gap-2 border-t py-6 first:border-t-0 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-baseline lg:gap-16"
            >
              <h3 className="font-editorial text-ink flex items-baseline gap-4 text-3xl font-light leading-tight sm:text-4xl lg:text-5xl">
                <span className="text-ink-muted w-8 shrink-0 text-lg tabular-nums sm:w-10 sm:text-xl">
                  {index + 1}
                </span>
                {step.title}
              </h3>
              <p className="text-ink-body text-pretty pl-12 text-lg leading-relaxed sm:pl-14 lg:pl-0">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ─── M: one line, five stops ────────────────────────────────────────────────

export function HowOneLine() {
  return (
    <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <ol className="mt-12 lg:mt-20 lg:grid lg:grid-cols-5 lg:gap-8">
          {HOW_STEPS.map((step, index) => {
            return (
              <li
                key={step.title}
                className={cn(
                  "reveal-on-scroll relative pb-10 pl-8 last:pb-0 lg:pb-0 lg:pl-0 lg:pt-10",
                  // the line: down the left on a phone, along the top from lg, ending at the last dot
                  "before:bg-ink/25 before:absolute before:left-[5px] before:top-2 before:h-full before:w-px before:content-[''] last:before:hidden lg:before:left-0 lg:before:top-[5px] lg:before:h-px lg:before:w-[calc(100%+2rem)]",
                  "after:bg-ink after:absolute after:left-0 after:top-2 after:h-[11px] after:w-[11px] after:rounded-full after:content-[''] lg:after:top-0"
                )}
              >
                <p className="text-ink-muted mb-3 text-sm font-medium tabular-nums">
                  Step {index + 1}
                </p>
                <h3 className="font-editorial text-ink mb-4 text-balance text-3xl font-normal leading-[1.1] tracking-tight">
                  {step.title}
                </h3>
                <p className="text-ink-body max-w-[30ch] text-pretty text-base leading-relaxed">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

// ─── N: one large sentence ──────────────────────────────────────────────────

export function HowOneSentence() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />
        <p className="reveal-on-scroll font-editorial text-ink mt-12 max-w-5xl text-balance text-4xl font-light leading-[1.15] sm:text-5xl lg:mt-16 lg:text-6xl">
          {HOW_STEPS.map((step, index) => (
            <span key={step.title}>
              {step.title}
              {index < HOW_STEPS.length - 1 ? <span className="text-ink-muted">. </span> : "."}
            </span>
          ))}
        </p>
        <ol className="mt-12 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-5">
          {HOW_STEPS.map((step, index) => (
            <li key={step.title} className="border-ink/20 border-t pt-4">
              <span className="text-ink-muted mb-1 block text-sm tabular-nums">{index + 1}</span>
              <p className="text-ink-body text-pretty text-base leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
