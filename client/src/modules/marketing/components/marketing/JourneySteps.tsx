"use client";

import { cn } from "@/utils/cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import React, { useId, useRef, useState } from "react";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * The five steps from the 20 Oct review: PMS must gather context before it
 * recommends, so asking about the child comes before the recommendation, and what
 * the parent decides is kept so the journey carries on.
 *
 * The titles and the first four steps follow the review. The last step says
 * "remembers" where the review says "learns", and does not promise that outcomes
 * change future recommendations: outcomes are kept (decisions, check-ins) but
 * nothing reads them back yet. Change it when that is built.
 *
 * Every line under a step names something that exists today; the links in step 4
 * are real pages. Where a feature is tennis-first the line says so.
 */
interface Step {
  title: string;
  lead: string;
  listLabel: string;
  items: Array<string | { label: string; href: string }>;
}

const STEPS: Step[] = [
  {
    title: "Choose a question",
    lead: "Pick a suggested question, or describe what you want for your child.",
    listLabel: "Questions parents start with",
    items: [
      "Which sport is right for my 8-year-old?",
      "Which tournaments should my son play?",
      "Is my child ready to start competing?",
    ],
  },
  {
    title: "PMS understands",
    lead: "We ask about your child, your goals, their current level and anything that limits you.",
    listLabel: "What we ask about",
    items: [
      "Your child's age and the sport they play",
      "Their current level and how long they have played",
      "What you want from this season",
      "Time, budget and travel limits",
    ],
  },
  {
    title: "PMS recommends",
    lead: "Your child's situation is combined with what we know about the sport, and the next step is explained.",
    listLabel: "What you get",
    items: [
      "Sport matches, and a pathway for each stage",
      "Tournaments they can enter, starting with tennis",
      "A season planned around exams and budget",
    ],
  },
  {
    title: "PMS helps execute",
    lead: "Find the options, connect with experts, plan the season, book or complete the step.",
    listLabel: "Where to go next",
    items: [
      { label: "Tournaments and entry dates", href: "/tournaments" },
      { label: "Plan the season", href: "/planner" },
      { label: "Book an expert", href: "/booking" },
      { label: "Admissions and scholarships", href: "/admissions" },
    ],
  },
  {
    title: "PMS remembers",
    lead: "Your decisions and check-ins are kept with your child's journey, so you can pick up where you left off.",
    listLabel: "What is kept",
    items: [
      "Choices you make, like a chosen sport or a shortlisted event",
      "Check-ins on how it is going",
      "All of it under My Child, which you can delete any time",
    ],
  },
];

/**
 * The five-step "from questions to action" band as a stepper. A row of five steps
 * runs across the top, its rule filling up to the step being read, and the open
 * step's detail sits in one wide panel below. All five panels are in the page
 * (the closed ones are `hidden`), so the text is there without script; the tabs
 * follow the standard tablist keyboard pattern. Nothing animates beyond a colour
 * change.
 */
export function JourneySteps() {
  const [active, setActive] = useState(0);
  const uid = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const go = (to: number, focus = false) => {
    const index = (to + STEPS.length) % STEPS.length;
    setActive(index);
    const tab = tabRefs.current[index];
    // On a phone the row of steps scrolls sideways; keep the open one in view.
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
      End: STEPS.length - 1,
    };
    const to = keys[event.key];
    if (to === undefined) return;
    event.preventDefault();
    go(to, true);
  };

  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="How it works" />
          <h2 className={SECTION_HEADING}>From questions to action</h2>
        </div>

        <div className="reveal-on-scroll mt-12 lg:mt-16">
          <div
            role="tablist"
            aria-label="How PMS works, in five steps"
            className="hide-scrollbar -mx-4 flex gap-0 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0"
          >
            {STEPS.map((step, index) => {
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
                    // The rule fills up to the step being read, so the path reads as progress.
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
            {STEPS.map((step, index) => (
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
                  {step.lead}
                </p>

                <div>
                  <p className="text-ink-muted mb-3 text-sm font-medium">{step.listLabel}</p>
                  <ul className="border-hairline border-t">
                    {step.items.map((item) => (
                      <li
                        key={typeof item === "string" ? item : item.label}
                        className="border-hairline border-b"
                      >
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

                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink focus-visible:ring-offset-paper mt-6 inline-flex items-center gap-1.5 rounded text-base font-medium underline underline-offset-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    {index < STEPS.length - 1
                      ? `Next: ${STEPS[index + 1]?.title}`
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
