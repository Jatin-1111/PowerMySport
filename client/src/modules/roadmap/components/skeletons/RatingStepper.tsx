"use client";

import { motion } from "framer-motion";

import { StageChips, stageStatus } from "./StageChips";
import { StepperProps } from "./types";

// ─── Rating skeleton: milestone staircase ───────────────────────────────────
//
// Progress in a rating sport is a single number that climbs — so the visual
// is a bar-chart staircase: each stage stands on a base bar that rises with
// the milestone it represents (Unrated → State → National → International).

export function RatingStepper({
  stages,
  activeIdx,
  onSelect,
  currentLevel,
  personaName,
  goalRawLevel,
}: StepperProps) {
  const n = stages.length;

  return (
    <>
      {/* ─── Desktop: staircase columns ─────────────────────────────────────── */}
      <div
        className="hidden lg:grid items-end gap-4 px-6 pt-6 pb-0"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {stages.map((macro, i) => {
          const c = macro.stepper;
          const isActive = i === activeIdx;
          const { isCurrent, isGoal } = stageStatus(macro, currentLevel, goalRawLevel);
          // Rising base bar: 18px → 90px across the staircase.
          const barHeight = 18 + Math.round((i / Math.max(n - 1, 1)) * 72);

          return (
            <button
              key={macro.id}
              type="button"
              onClick={() => onSelect(i)}
              className="group flex flex-col justify-end text-left focus:outline-none"
            >
              {/* Card */}
              <motion.div
                animate={{
                  background: isActive ? c.soft : "#ffffff",
                  borderColor: isActive ? c.hex : "#e2e8f0",
                  boxShadow: isActive
                    ? `0 10px 26px -10px ${c.hex}66`
                    : "0 1px 2px rgba(0,0,0,0.04)",
                }}
                transition={{ duration: 0.22 }}
                className="flex flex-col gap-2.5 rounded-2xl border-2 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: isActive ? c.hex : c.soft,
                      color: isActive ? "#fff" : c.hex,
                    }}
                  >
                    {macro.icon}
                  </span>
                  <StageChips
                    isCurrent={isCurrent}
                    isGoal={isGoal}
                    personaName={personaName}
                    palette={c}
                  />
                </div>
                <div>
                  <p
                    className="text-sm font-extrabold leading-tight"
                    style={{ color: isActive ? c.hex : "#1e293b" }}
                  >
                    {macro.label}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400">
                    {macro.scopeTag}
                  </p>
                </div>
                <span
                  className="self-start rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: isActive ? c.ring : "#f1f5f9",
                    color: isActive ? c.dark : "#94a3b8",
                  }}
                >
                  {macro.durationNote}
                </span>
              </motion.div>

              {/* Rising milestone bar */}
              <motion.div
                className="mx-3 rounded-t-lg"
                animate={{
                  height: barHeight,
                  background: isActive
                    ? `linear-gradient(180deg, ${c.hex}, ${c.hex}55)`
                    : `linear-gradient(180deg, ${c.ring}, ${c.soft})`,
                }}
                transition={{ duration: 0.3 }}
              />
            </button>
          );
        })}
      </div>
      {/* Baseline the staircase stands on */}
      <div className="hidden lg:block h-[3px] bg-slate-100 mx-6 mb-6 rounded-full" />

      {/* ─── Mobile: milestone rows with rising notches ─────────────────────── */}
      <div className="flex lg:hidden flex-col divide-y divide-slate-100">
        {stages.map((macro, i) => {
          const c = macro.stepper;
          const isActive = i === activeIdx;
          const { isCurrent, isGoal } = stageStatus(macro, currentLevel, goalRawLevel);

          return (
            <button
              key={macro.id}
              type="button"
              onClick={() => onSelect(i)}
              className="relative flex items-center gap-4 px-5 py-4 text-left focus:outline-none transition-colors duration-300"
              style={{ background: isActive ? c.soft : "#fff" }}
            >
              {/* Rising notch: taller bar = higher milestone */}
              <div className="flex h-11 w-4 shrink-0 items-end justify-center">
                <motion.span
                  className="w-2 rounded-full"
                  animate={{
                    height: `${30 + (i / Math.max(stages.length - 1, 1)) * 70}%`,
                    background: isActive ? c.hex : c.ring,
                  }}
                  transition={{ duration: 0.25 }}
                />
              </div>

              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: isActive ? c.hex : c.soft,
                  color: isActive ? "#fff" : c.hex,
                }}
              >
                {macro.icon}
              </span>

              <div className="flex-1 min-w-0">
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
          );
        })}
      </div>
    </>
  );
}
