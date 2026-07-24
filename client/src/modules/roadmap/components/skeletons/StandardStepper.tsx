"use client";

import { motion } from "framer-motion";
import { Flag } from "lucide-react";

import { StageChips, stageStatus } from "./StageChips";
import { StepperProps } from "./types";

// ─── Standard skeleton: qualifying-marks track ──────────────────────────────
//
// Advancement here means beating a fixed, published time/score standard — so
// every stage card carries a mini qualifying track whose bar sits higher the
// further along the journey you are, with a flag marking the mark to clear.

export function StandardStepper({
  stages,
  activeIdx,
  onSelect,
  currentLevel,
  unit,
  personaName,
  goalRawLevel,
}: StepperProps) {
  const n = stages.length;
  const unitWord = unit === "score" ? "score" : unit === "time" ? "time" : "mark";

  const QualifyingTrack = ({
    index,
    active,
    hex,
    ring,
  }: {
    index: number;
    active: boolean;
    hex: string;
    ring: string;
  }) => {
    const pct = ((index + 1) / n) * 100;
    return (
      <div className="relative">
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            animate={{
              width: `${pct}%`,
              background: active
                ? `linear-gradient(90deg, ${hex}66, ${hex})`
                : ring,
            }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {/* Flag marking the standard to clear */}
        <Flag
          className="absolute -top-3 h-3.5 w-3.5 -translate-x-1/2"
          style={{ left: `${pct}%`, color: active ? hex : "#cbd5e1" }}
        />
      </div>
    );
  };

  return (
    <>
      {/* ─── Desktop: qualifying-bar cards ──────────────────────────────────── */}
      <div
        className="hidden lg:grid gap-4 px-6 py-6"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {stages.map((macro, i) => {
          const c = macro.stepper;
          const isActive = i === activeIdx;
          const { isCurrent, isGoal } = stageStatus(macro, currentLevel, goalRawLevel);

          return (
            <motion.button
              key={macro.id}
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
              className="flex flex-col gap-3 rounded-2xl border-2 p-4 text-left focus:outline-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
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

              {/* The bar to clear */}
              <div className="mt-1 pt-2">
                <QualifyingTrack index={i} active={isActive} hex={c.hex} ring={c.ring} />
                <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {i === 0 ? `No ${unitWord} bar yet` : `The ${unitWord} bar rises`}
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
            </motion.button>
          );
        })}
      </div>

      {/* ─── Mobile: stacked rows with mini tracks ──────────────────────────── */}
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
              className="relative flex flex-col gap-2.5 px-5 py-4 text-left focus:outline-none transition-colors duration-300"
              style={{ background: isActive ? c.soft : "#fff" }}
            >
              <div className="flex items-center gap-3">
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
              </div>
              <div className="pl-[52px] pr-2 pt-1.5">
                <QualifyingTrack index={i} active={isActive} hex={c.hex} ring={c.ring} />
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
