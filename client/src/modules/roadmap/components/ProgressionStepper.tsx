"use client";

import { MacroLevel } from "@/modules/sports/config/macroLevels";
import { motion } from "framer-motion";

const STAGE = [
  { hex: "#10b981", soft: "#ecfdf5", ring: "#a7f3d0", dark: "#065f46" },
  { hex: "#f59e0b", soft: "#fffbeb", ring: "#fde68a", dark: "#78350f" },
  { hex: "#8b5cf6", soft: "#f5f3ff", ring: "#ddd6fe", dark: "#4c1d95" },
];

const DURATION = ["~12–18 months to next", "~2–4 years to next", "Peak stage"];

interface ProgressionStepperProps {
  macroLevels: MacroLevel[];
  activeIdx: number;
  onSelect: (i: number) => void;
  currentLevel: number;
}

export function ProgressionStepper({
  macroLevels,
  activeIdx,
  onSelect,
  currentLevel,
}: ProgressionStepperProps) {
  return (
    <>
      {/* ─── Desktop: three-panel card selector ─────────────────────────────── */}
      <div className="hidden lg:grid grid-cols-3">
        {macroLevels.map((macro, i) => {
          const c = STAGE[i] ?? STAGE[0];
          const isActive = i === activeIdx;
          const isCurrent = macro.rawLevels.some((l) => l.level === currentLevel);

          return (
            <button
              key={macro.id}
              type="button"
              onClick={() => onSelect(i)}
              className="relative flex flex-col text-left focus:outline-none overflow-hidden transition-colors duration-300 border-r border-slate-100 last:border-r-0"
              style={{ background: isActive ? c.soft : "#ffffff" }}
            >
              {/* Top accent bar */}
              <motion.div
                className="h-[3px] w-full shrink-0"
                animate={{ opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.2 }}
                style={{ background: `linear-gradient(90deg, ${c.hex}, ${c.hex}66)` }}
              />

              <div className="flex flex-col gap-5 px-8 py-7">
                {/* Icon + meta row */}
                <div className="flex items-start justify-between">
                  {/* Icon circle */}
                  <motion.div
                    animate={{
                      background: isActive ? c.hex : c.soft,
                      boxShadow: isActive ? `0 6px 20px ${c.hex}44` : "0 0 0 transparent",
                    }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center justify-center rounded-2xl"
                    style={{ width: 56, height: 56, color: isActive ? "#fff" : c.hex }}
                  >
                    {macro.icon}
                  </motion.div>

                  {/* Step number + current badge */}
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className="text-[11px] font-black tracking-[0.18em] transition-colors duration-200"
                      style={{ color: isActive ? c.hex : "#d1d5db" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {isCurrent && (
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: c.ring, color: c.dark }}
                      >
                        Your level
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage name & scope */}
                <div className="flex flex-col gap-1">
                  <span
                    className="text-[15px] font-extrabold leading-tight transition-colors duration-200"
                    style={{ color: isActive ? c.hex : "#1e293b" }}
                  >
                    {macro.label}
                  </span>
                  <span
                    className="text-[11px] font-medium transition-colors duration-200"
                    style={{ color: isActive ? c.hex + "99" : "#94a3b8" }}
                  >
                    {macro.scopeTag}
                  </span>
                </div>

                {/* Duration chip */}
                <span
                  className="self-start rounded-full px-3 py-[5px] text-[10px] font-semibold transition-all duration-300"
                  style={{
                    background: isActive ? c.ring : "#f1f5f9",
                    color: isActive ? c.dark : "#94a3b8",
                  }}
                >
                  {DURATION[i]}
                </span>
              </div>

              {/* Watermark number in corner */}
              <span
                className="absolute -bottom-2 right-2 text-[72px] font-black leading-none select-none pointer-events-none transition-colors duration-300"
                style={{ color: isActive ? c.hex + "12" : "#f8fafc" }}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Mobile: stacked row cards ──────────────────────────────────────── */}
      <div className="flex lg:hidden flex-col divide-y divide-slate-100">
        {macroLevels.map((macro, i) => {
          const c = STAGE[i] ?? STAGE[0];
          const isActive = i === activeIdx;
          const isCurrent = macro.rawLevels.some((l) => l.level === currentLevel);

          return (
            <button
              key={macro.id}
              type="button"
              onClick={() => onSelect(i)}
              className="relative flex items-center gap-4 px-5 py-4 text-left focus:outline-none transition-colors duration-300 overflow-hidden"
              style={{ background: isActive ? c.soft : "#fff" }}
            >
              {/* Left accent */}
              <motion.div
                className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                animate={{ opacity: isActive ? 1 : 0 }}
                style={{ background: c.hex }}
              />

              {/* Icon */}
              <motion.div
                animate={{
                  background: isActive ? c.hex : c.soft,
                  boxShadow: isActive ? `0 4px 12px ${c.hex}40` : "none",
                }}
                transition={{ duration: 0.22 }}
                className="shrink-0 flex items-center justify-center rounded-xl"
                style={{ width: 44, height: 44, color: isActive ? "#fff" : c.hex }}
              >
                {macro.icon}
              </motion.div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-bold transition-colors duration-200"
                    style={{ color: isActive ? c.hex : "#1e293b" }}
                  >
                    {macro.label}
                  </span>
                  {isCurrent && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: c.ring, color: c.dark }}
                    >
                      Your level
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">{macro.scopeTag}</span>
              </div>

              {/* Step number */}
              <span
                className="shrink-0 text-[11px] font-black transition-colors duration-200"
                style={{ color: isActive ? c.hex : "#e2e8f0" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
