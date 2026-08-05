"use client";

// ─── Guided walk ────────────────────────────────────────────────────────────
//
// "Navigate between paths effortlessly" needs more than a clickable canvas — a
// parent seeing a graph for the first time doesn't know where to start. With a
// goal chosen, this walks them along that route one node at a time, panning the
// canvas to keep up.
//
// Deliberately excludes fast-track and open-but-not-ready edges (see
// orderedRoute): a guided walk must never quietly recommend a shortcut.

import { ArrowLeft, ArrowRight, Footprints } from "lucide-react";

import { GOALS } from "../../graph/goals";
import { GoalId } from "../../graph/types";

interface PathStepperProps {
  goalId: GoalId;
  route: string[];
  labelFor: (id: string) => string;
  /** Index into `route`, or -1 when the walk hasn't started. */
  index: number;
  onStep: (index: number) => void;
}

export function PathStepper({
  goalId,
  route,
  labelFor,
  index,
  onStep,
}: PathStepperProps) {
  if (route.length < 2) return null;
  const goal = GOALS[goalId];
  const atStart = index <= 0;
  const atEnd = index >= route.length - 1;
  const currentLabel = index >= 0 ? labelFor(route[index]) : null;

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ borderColor: goal.accent.ring, background: goal.accent.soft }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ background: goal.accent.ring, color: goal.accent.hex }}
      >
        <Footprints className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: goal.accent.hex }}
        >
          Step {Math.max(index, 0) + 1} of {route.length} · to {goal.short}
        </p>
        <p className="truncate text-sm font-bold text-slate-800">
          {currentLabel ?? labelFor(route[0])}
        </p>
      </div>

      {/* Progress dots double as direct jumps */}
      <div className="flex items-center gap-1">
        {route.map((id, i) => (
          <button
            key={id}
            type="button"
            data-graph-interactive
            onClick={() => onStep(i)}
            aria-label={`Go to ${labelFor(id)}`}
            className="rounded-full transition-all"
            style={{
              width: i === index ? 20 : 7,
              height: 7,
              background: i <= index ? goal.accent.hex : goal.accent.ring,
            }}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          data-graph-interactive
          disabled={atStart}
          onClick={() => onStep(Math.max(index - 1, 0))}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white bg-white/80 text-slate-600 shadow-sm transition enabled:hover:text-slate-900 disabled:opacity-40"
          aria-label="Previous step"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          data-graph-interactive
          disabled={atEnd}
          onClick={() => onStep(Math.min(Math.max(index, 0) + 1, route.length - 1))}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-40"
          style={{ background: goal.accent.hex }}
        >
          Next step
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
