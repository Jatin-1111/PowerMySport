"use client";

import { cn } from "@/utils/cn";
import { AnimatePresence, MotionConfig, motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useId, useRef, useState } from "react";
import { HOW_STEPS, type HowStep } from "../../data/howItWorksSteps";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * The two "How it works" options that need script. Same rules as the other motion on
 * the site: transform and opacity only, content in the page before any script runs,
 * and reduced motion turns the movement off.
 *
 *  C  A five-step stepper. A row of steps whose rule fills up to the open one, and one
 *     wide panel below for its detail.
 *  F  A scroll story. A giant numeral stays in view and changes as each step is read.
 */

const EASE = [0.32, 0.72, 0, 1] as const;

function Header() {
  return (
    <div className="reveal-on-scroll max-w-3xl">
      <SectionKicker label="How it works" />
      <h2 className={SECTION_HEADING}>From questions to action</h2>
    </div>
  );
}

function ListRows({ step }: { step: HowStep }) {
  return (
    <ul className="border-hairline border-t">
      {step.items.map((item) => (
        <li key={typeof item === "string" ? item : item.label} className="border-hairline border-b">
          {typeof item === "string" ? (
            <span className="text-ink block py-3.5 text-lg leading-snug">{item}</span>
          ) : (
            <Link
              href={item.href}
              className="text-ink hover:bg-paper-deep/60 focus-visible:ring-ink group/link -mx-3 flex items-center justify-between gap-4 rounded-md px-3 py-3.5 text-lg leading-snug transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
            >
              {item.label}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover/link:translate-x-0.5 motion-reduce:transition-none"
              />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── C: the stepper ─────────────────────────────────────────────────────────

export function HowStepper() {
  const [active, setActive] = useState(0);
  const uid = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const go = (to: number, focus = false) => {
    const index = (to + HOW_STEPS.length) % HOW_STEPS.length;
    setActive(index);
    const tab = tabRefs.current[index];
    tab?.scrollIntoView({ inline: "center", block: "nearest" });
    if (focus) tab?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const keys: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: HOW_STEPS.length - 1,
    };
    const to = keys[event.key];
    if (to === undefined) return;
    event.preventDefault();
    go(to, true);
  };

  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Header />

        <div className="reveal-on-scroll mt-12 lg:mt-16">
          <div
            role="tablist"
            aria-label="How PMS works, in five steps"
            className="hide-scrollbar -mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0"
          >
            {HOW_STEPS.map((step, index) => {
              const selected = index === active;
              return (
                <button
                  key={step.title}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${index}`}
                  aria-selected={selected}
                  aria-controls={`${uid}-panel-${index}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => go(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={cn(
                    "focus-visible:ring-ink focus-visible:ring-offset-paper group min-w-[9.5rem] flex-1 border-t-2 pb-2 pr-4 pt-5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-w-0",
                    index <= active ? "border-t-ink" : "border-t-hairline hover:border-t-ink/40"
                  )}
                >
                  <span
                    className={cn(
                      "font-editorial mb-3 block text-4xl font-light tabular-nums leading-none transition-colors duration-200",
                      selected ? "text-ink" : "text-ink-muted group-hover:text-ink"
                    )}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "block text-balance text-sm font-semibold leading-snug transition-colors duration-200 sm:text-base",
                      selected ? "text-ink" : "text-ink-body group-hover:text-ink"
                    )}
                  >
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-hairline mt-2 border-t pt-10 lg:min-h-[19rem] lg:pt-12">
            {HOW_STEPS.map((step, index) => (
              <div
                key={step.title}
                role="tabpanel"
                id={`${uid}-panel-${index}`}
                aria-labelledby={`${uid}-tab-${index}`}
                hidden={index !== active}
                tabIndex={0}
                className="focus-visible:ring-ink grid gap-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16"
              >
                <p className="font-editorial text-ink text-balance text-3xl font-light leading-[1.15] sm:text-4xl">
                  {step.body}
                </p>
                <div>
                  <p className="text-ink-muted mb-3 text-sm font-medium">{step.listLabel}</p>
                  <ListRows step={step} />
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink focus-visible:ring-offset-paper mt-6 inline-flex items-center gap-1.5 rounded text-base font-medium underline underline-offset-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {index < HOW_STEPS.length - 1
                      ? `Next: ${HOW_STEPS[index + 1]?.title}`
                      : "Back to step 1"}
                    <ArrowRight aria-hidden strokeWidth={1.5} className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── F: a scroll story with a giant numeral ─────────────────────────────────

function StoryPanel({
  step,
  index,
  onActive,
}: {
  step: HowStep;
  index: number;
  onActive: (index: number) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  // Counts as "being read" while it crosses a band in the middle of the screen.
  const reading = useInView(ref, { margin: "-42% 0px -42% 0px" });
  useEffect(() => {
    if (reading) onActive(index);
  }, [reading, index, onActive]);

  return (
    <li
      ref={ref}
      className="border-hairline border-t py-10 lg:flex lg:min-h-[62vh] lg:flex-col lg:justify-center lg:py-16"
    >
      {/* On a phone there is no fixed numeral, so each step carries its own. */}
      <span className="font-editorial text-ink mb-5 block text-6xl font-light tabular-nums leading-none lg:hidden">
        {index + 1}
      </span>
      <h3 className="text-ink mb-4 text-xl font-semibold lg:hidden">{step.title}</h3>
      <p className="font-editorial text-ink mb-8 max-w-[28ch] text-balance text-3xl font-light leading-[1.15] sm:text-4xl">
        {step.body}
      </p>
      <p className="text-ink-muted mb-3 text-sm font-medium">{step.listLabel}</p>
      <div className="max-w-xl">
        <ListRows step={step} />
      </div>
    </li>
  );
}

export function HowScrollStory() {
  const [active, setActive] = useState(0);
  const current = HOW_STEPS[active];

  return (
    <MotionConfig reducedMotion="user">
      <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Header />

          <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            {/* Stays in view on wide screens while the five steps are read. */}
            <div aria-hidden className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
              <div className="relative h-[13rem] overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={active}
                    initial={{ y: 28, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -28, opacity: 0 }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className="font-editorial text-ink absolute left-0 top-0 block text-[11rem] font-light tabular-nums leading-[0.9]"
                  >
                    {active + 1}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="mt-4 h-8 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={active}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="text-ink text-xl font-semibold"
                  >
                    {current?.title}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="mt-6 grid max-w-sm grid-cols-5 gap-1.5">
                {HOW_STEPS.map((step, index) => (
                  <span
                    key={step.title}
                    className="bg-ink/15 relative h-[3px] overflow-hidden rounded-[1px]"
                  >
                    <motion.span
                      initial={false}
                      animate={{ scaleX: index <= active ? 1 : 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="bg-ink absolute inset-0 origin-left"
                    />
                  </span>
                ))}
              </div>
            </div>

            <ol>
              {HOW_STEPS.map((step, index) => (
                <StoryPanel key={step.title} step={step} index={index} onActive={setActive} />
              ))}
            </ol>
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
