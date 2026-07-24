"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { StageChips, stageStatus } from "./StageChips";
import { StepperProps } from "./types";

// ─── Ranking skeleton: tournament-circuit ladder ────────────────────────────
//
// Advancement here is earned in ranking points, tournament after tournament —
// so the visual is a connected circuit: tier cards chained left-to-right with
// arrows, each labelled as a rung of the ranking ladder.

export function RankingStepper({
  stages,
  activeIdx,
  onSelect,
  currentLevel,
  personaName,
  goalRawLevel,
}: StepperProps) {
  return (
    <>
      {/* ─── Desktop: chained tier cards ────────────────────────────────────── */}
      <div className="hidden lg:flex items-stretch px-6 py-6 gap-0">
        {stages.map((macro, i) => {
          const c = macro.stepper;
          const isActive = i === activeIdx;
          const { isCurrent, isGoal } = stageStatus(macro, currentLevel, goalRawLevel);

          return (
            <div key={macro.id} className="flex flex-1 items-stretch min-w-0">
              <motion.button
                type="button"
                onClick={() => onSelect(i)}
                animate={{
                  background: isActive ? c.soft : "#ffffff",
                  borderColor: isActive ? c.hex : "#e2e8f0",
                  y: isActive ? -3 : 0,
                  boxShadow: isActive
                    ? `0 10px 26px -10px ${c.hex}66`
                    : "0 1px 2px rgba(0,0,0,0.04)",
                }}
                transition={{ duration: 0.22 }}
                className="relative flex flex-1 min-w-0 flex-col gap-3 rounded-2xl border-2 p-4 text-left focus:outline-none"
              >
                {/* Tier tag */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                    style={{
                      background: isActive ? c.hex : c.soft,
                      color: isActive ? "#fff" : c.hex,
                    }}
                  >
                    Rung {i + 1} of {stages.length}
                  </span>
                  <StageChips
                    isCurrent={isCurrent}
                    isGoal={isGoal}
                    personaName={personaName}
                    palette={c}
                  />
                </div>

                {/* Icon + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: isActive ? c.hex : c.soft,
                      color: isActive ? "#fff" : c.hex,
                    }}
                  >
                    {macro.icon}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-extrabold leading-tight truncate"
                      style={{ color: isActive ? c.hex : "#1e293b" }}
                    >
                      {macro.label}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 truncate">
                      {macro.scopeTag}
                    </p>
                  </div>
                </div>

                {/* Duration chip */}
                <span
                  className="self-start rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: isActive ? c.ring : "#f1f5f9",
                    color: isActive ? c.dark : "#94a3b8",
                  }}
                >
                  {macro.durationNote}
                </span>
              </motion.button>

              {/* Chain connector */}
              {i < stages.length - 1 && (
                <div className="flex shrink-0 items-center px-1">
                  <ChevronRight
                    className="h-5 w-5"
                    style={{
                      color: i < activeIdx ? stages[i + 1].stepper.hex : "#cbd5e1",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Mobile: vertical circuit timeline ──────────────────────────────── */}
      <div className="flex lg:hidden flex-col px-4 py-4">
        {stages.map((macro, i) => {
          const c = macro.stepper;
          const isActive = i === activeIdx;
          const { isCurrent, isGoal } = stageStatus(macro, currentLevel, goalRawLevel);

          return (
            <div key={macro.id} className="flex gap-3">
              {/* Rail: dot + connecting line */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-colors"
                  style={{
                    background: isActive ? c.hex : c.soft,
                    color: isActive ? "#fff" : c.hex,
                    boxShadow: isActive ? `0 4px 12px ${c.hex}55` : "none",
                  }}
                >
                  {i + 1}
                </span>
                {i < stages.length - 1 && (
                  <span className="w-px flex-1 bg-slate-200" />
                )}
              </div>

              <button
                type="button"
                onClick={() => onSelect(i)}
                className="mb-3 flex flex-1 items-center gap-3 rounded-2xl border-2 p-3 text-left transition-all focus:outline-none"
                style={{
                  background: isActive ? c.soft : "#fff",
                  borderColor: isActive ? c.hex : "#e2e8f0",
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: isActive ? c.hex : c.soft,
                    color: isActive ? "#fff" : c.hex,
                  }}
                >
                  {macro.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-bold truncate"
                      style={{ color: isActive ? c.hex : "#1e293b" }}
                    >
                      {macro.label}
                    </span>
                    <StageChips
                      isCurrent={isCurrent}
                      isGoal={isGoal}
                      personaName={personaName}
                      palette={c}
                      compact
                    />
                  </div>
                  <span className="block text-[11px] text-slate-400 truncate">
                    {macro.scopeTag} · {macro.durationNote}
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
