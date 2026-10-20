import { cn } from "@/utils/cn";
import React from "react";
import { HOW_STEPS } from "../../data/howItWorksSteps";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * The homepage "How it works" band: one line with five stops, down the left on a phone
 * and along the top from lg. Only the review's titles and one-line descriptions, so a
 * parent can take it in at a glance.
 */
export function HowItWorks() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="How it works" />
          <h2 className={SECTION_HEADING}>From questions to action</h2>
        </div>

        <ol className="mt-12 lg:mt-20 lg:grid lg:grid-cols-5 lg:gap-8">
          {HOW_STEPS.map((step, index) => (
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
          ))}
        </ol>
      </div>
    </section>
  );
}
