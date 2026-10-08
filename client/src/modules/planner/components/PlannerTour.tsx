"use client";

import { Button } from "@/modules/shared/ui/Button";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * A four-step walk through the planner for a parent seeing it for the first time.
 *
 * ── How it points at things ─────────────────────────────────────────────────
 * Each step names a section of the page by its `data-tour` attribute. The tour rings
 * that section and scrolls it into view; the explanation sits in a card fixed to the
 * bottom of the screen, clear of the assistant button in the corner (bottom-right, and
 * above the phone nav bar), so neither can cover the Next button.
 * Nothing is dimmed and nothing is trapped, so a parent can still read and use the
 * page while it is open, and the card never covers the thing it describes for long
 * because the section is scrolled to the middle of the screen.
 *
 * The sections have to exist for a step to point at them. A step whose target is
 * missing still shows its words and simply rings nothing.
 *
 * ── What the words promise ──────────────────────────────────────────────────
 * Step three says the planner never enters a tournament for the parent. That is the
 * one thing a first-time visitor is most likely to assume wrongly, so it is said once,
 * early, and in plain words.
 */

export const TOUR_STEPS = [
  {
    target: "setup",
    title: "Tell us what matters this season",
    body: "Choose a goal, add dates your child can't play, and set a budget if you have one. We use these to choose tournaments for you. You can skip this and change it any time.",
  },
  {
    target: "pick",
    title: "Pick tournaments",
    body: "Press Suggest my season for a short list, or look through everything open to your child. Add the ones you like to your plan.",
  },
  {
    target: "next",
    title: "Follow your plan",
    body: "This box shows the next thing to do, such as a deadline to enter. We never enter for you. You finish each entry on the AITA website.",
  },
  {
    target: "calendar",
    title: "Check the calendar",
    body: "Open the calendar to see your tournaments month by month and spot clashes. You don't need it to make a plan.",
  },
] as const;

const RING = ["ring-2", "ring-orange-500", "ring-offset-4", "rounded-lg"] as const;

export function PlannerTour({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const card = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index]!;
  const last = index === TOUR_STEPS.length - 1;

  // Ring the section this step is about, and take the ring off when the step changes
  // or the tour closes. Done on the element itself because the sections belong to
  // other components that do not know a tour exists.
  useEffect(() => {
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!element) return;
    element.classList.add(...RING);
    element.scrollIntoView?.({ block: "center", behavior: "smooth" });
    return () => element.classList.remove(...RING);
  }, [step.target]);

  // A keyboard user who pressed "How this works" should land on the tour, and a screen
  // reader should hear each step as it changes.
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
  }, [index]);

  return (
    <div
      ref={card}
      role="dialog"
      aria-label="Planner tour"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") onFinish();
      }}
      className="fixed inset-x-3 bottom-28 z-40 mx-auto max-w-md rounded-xl border border-slate-300 bg-white p-4 shadow-lg focus-visible:outline-none sm:inset-x-auto sm:bottom-6 sm:right-28 sm:mx-0"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Step {index + 1} of {TOUR_STEPS.length}
        </p>
        <button
          type="button"
          onClick={onFinish}
          aria-label="Close tour"
          className="-m-1 rounded p-1 text-slate-500 hover:text-slate-900"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div aria-live="polite">
        <h2 className="font-title mt-1 text-base font-extrabold text-slate-900">{step.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{step.body}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onFinish}
          className="text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
        >
          Skip tour
        </button>
        <div className="flex gap-2">
          {index > 0 && (
            <Button variant="outline" size="sm" onClick={() => setIndex(index - 1)}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={() => (last ? onFinish() : setIndex(index + 1))}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
