"use client";

// ─── Goal rail ──────────────────────────────────────────────────────────────
//
// The primary navigation. Picking a goal is how a parent moves between paths:
// the matching route lights up and everything else fades to context rather than
// disappearing, so they can always see what they're NOT choosing.

import { motion } from "framer-motion";
import { Layers } from "lucide-react";

import { GOALS } from "../../graph/goals";
import { GoalId } from "../../graph/types";
import { nodeIcon } from "./tokens";

interface GoalRailProps {
  goals: GoalId[];
  selected: GoalId | null;
  onSelect: (goal: GoalId | null) => void;
  /** Goal derived from the family's stated ambition, badged as theirs. */
  personaGoal: GoalId | null;
  personaName?: string;
}

export function GoalRail({
  goals,
  selected,
  onSelect,
  personaGoal,
  personaName,
}: GoalRailProps) {
  const active = selected ? GOALS[selected] : null;

  return (
    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:px-5">
      <div className="mb-2.5 flex items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Where could this lead?
        </p>
        <span className="hidden text-[11px] text-slate-400 sm:inline">
          — pick a destination to light up the route
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-graph-interactive
          onClick={() => onSelect(null)}
          className={`relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
            selected === null
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-800"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          All paths
        </button>

        {goals.map((id) => {
          const goal = GOALS[id];
          const isSelected = selected === id;
          const isPersona = personaGoal === id;
          return (
            <button
              key={id}
              type="button"
              data-graph-interactive
              onClick={() => onSelect(id)}
              className="relative flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all"
              style={
                isSelected
                  ? {
                      background: goal.accent.hex,
                      borderColor: goal.accent.hex,
                      color: "#fff",
                      boxShadow: `0 4px 14px -4px ${goal.accent.hex}88`,
                    }
                  : {
                      background: "#fff",
                      borderColor: goal.accent.ring,
                      color: goal.accent.dark,
                    }
              }
            >
              <span className="h-3.5 w-3.5">{nodeIcon(goal.icon)}</span>
              {goal.short}
              {isPersona && (
                <span
                  className="ml-0.5 rounded-full px-1.5 py-px text-[9px] font-black uppercase tracking-wide"
                  style={
                    isSelected
                      ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                      : { background: goal.accent.soft, color: goal.accent.hex }
                  }
                >
                  {personaName ? `${personaName}'s` : "Yours"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {active && (
        <motion.p
          key={active.id}
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2.5 text-xs leading-relaxed text-slate-500"
        >
          <span className="font-bold" style={{ color: active.accent.dark }}>
            {active.label}:
          </span>{" "}
          {active.blurb}
        </motion.p>
      )}
    </div>
  );
}
