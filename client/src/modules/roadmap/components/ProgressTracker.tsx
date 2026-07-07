"use client";

import {
    groupLevelsIntoMacro,
    MacroLevelId,
} from "@/modules/sports/config/macroLevels";
import {
    PathwayLevel,
} from "@/modules/sports/services/pathway";
import { AnimatePresence, motion } from "framer-motion";
import {
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Circle,
    PartyPopper,
    Pin,
    Trophy,
    X,
} from "lucide-react";
import { useState } from "react";

import { ProgressState } from '../types';

// ─── P1: Progress Tracker ─────────────────────────────────────────────────────

export function ProgressTracker({
  progress,
  onChange,
  levels,
}: {
  progress: ProgressState;
  onChange: (p: ProgressState) => void;
  levels: PathwayLevel[];
}) {
  const [open, setOpen] = useState(false);

  const currentLevelData =
    progress.currentLevel > 0
      ? levels.find((l) => l.level === progress.currentLevel)
      : null;

  // The main "Level progression" stepper below now speaks in 3 macro tiers —
  // mirror that language here instead of the old raw 1-5 numbering, which
  // otherwise reads as a contradicting, separate level system to a parent.
  const macroLevels = groupLevelsIntoMacro(levels);
  const currentMacro =
    macroLevels.find((m) =>
      m.rawLevels.some((l) => l.level === progress.currentLevel),
    ) || null;
  const [pickerMacroId, setPickerMacroId] = useState<MacroLevelId | null>(
    () => currentMacro?.id ?? null,
  );
  const activePickerMacro =
    macroLevels.find((m) => m.id === pickerMacroId) || null;

  const toggleStep = (levelNum: number, stepIdx: number) => {
    const safeCompletedSteps = progress.completedSteps || {};
    const existing = safeCompletedSteps[levelNum] || [];
    const updated = [...existing];
    updated[stepIdx] = !updated[stepIdx];
    const next: ProgressState = {
      ...progress,
      completedSteps: { ...safeCompletedSteps, [levelNum]: updated },
    };
    onChange(next);
  };

  const setLevel = (lvl: number) => {
    const next: ProgressState = { ...progress, currentLevel: lvl };
    onChange(next);
  };

  const stepsForCurrentLevel = currentLevelData?.steps || [];
  const safeCompletedSteps = progress.completedSteps || {};
  const completedForLevel = safeCompletedSteps[progress.currentLevel] || [];
  const completedCount = completedForLevel.filter(Boolean).length;
  const totalSteps = stepsForCurrentLevel.length;
  const remainingCount = totalSteps - completedCount;

  const nextLevel =
    progress.currentLevel > 0 && progress.currentLevel < 5
      ? levels.find((l) => l.level === progress.currentLevel + 1)
      : null;


  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <Pin className="h-4 w-4 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Where Is My Child Now?
          </p>
          {progress.currentLevel > 0 ? (
            <div className="flex min-w-0 items-baseline gap-1.5">
              <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                {currentMacro?.label} · {currentLevelData?.label}
              </p>
              <span className="shrink-0 text-xs font-semibold text-slate-500">
                {completedCount}/{totalSteps} done
              </span>
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">
              Tap to mark your child's current level
            </p>
          )}
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-slate-400"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.18 },
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
              {/* Level selector */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Current Level
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {macroLevels.map((macro) => {
                    const active = macro.rawLevels.some(
                      (l) => l.level === progress.currentLevel,
                    );
                    return (
                      <button
                        key={macro.id}
                        type="button"
                        onClick={() => {
                          setPickerMacroId(macro.id);
                          if (macro.rawLevels.length === 1)
                            setLevel(macro.rawLevels[0].level);
                        }}
                        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? `bg-gradient-to-r ${macro.gradient} text-white border-transparent shadow-md`
                            : `border-slate-200 bg-white text-slate-600 hover:border-slate-300`
                        }`}
                      >
                        {active && (
                          <CheckCircle2 className="h-3 w-3 shrink-0" />
                        )}
                        {macro.label}
                      </button>
                    );
                  })}
                  {progress.currentLevel > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setLevel(0);
                        setPickerMacroId(null);
                      }}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-50 transition"
                    >
                      <X className="h-3 w-3" /> Clear
                    </button>
                  )}
                </div>

                {/* Which specific stage within this tier? Only asked when the tier has more than one. */}
                {activePickerMacro &&
                  activePickerMacro.rawLevels.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-l-2 border-slate-100 pl-2.5">
                      {activePickerMacro.rawLevels.map((lv) => {
                        const active = progress.currentLevel === lv.level;
                        return (
                          <button
                            key={lv.level}
                            type="button"
                            onClick={() => setLevel(lv.level)}
                            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                              active
                                ? `bg-gradient-to-r ${activePickerMacro.gradient} text-white border-transparent shadow-sm`
                                : `border-slate-200 bg-white text-slate-500 hover:border-slate-300`
                            }`}
                          >
                            {active && (
                              <CheckCircle2 className="h-3 w-3 shrink-0" />
                            )}
                            {lv.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>

              {/* Objectives for current level */}
              {currentLevelData && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Objectives at this level
                  </p>
                  <ul className="space-y-2">
                    {stepsForCurrentLevel.map((step, idx) => {
                      const done = !!completedForLevel[idx];
                      return (
                        <li key={idx}>
                          <button
                            type="button"
                            onClick={() =>
                              toggleStep(progress.currentLevel, idx)
                            }
                            className={`w-full flex items-start gap-2.5 rounded-xl border p-2.5 text-left text-sm transition-all ${
                              done
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                            )}
                            <span
                              className={done ? "line-through opacity-70" : ""}
                            >
                              {step}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Gap / progress summary */}
                  {remainingCount > 0 && nextLevel ? (
                    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 flex items-center gap-2">
                      <ChevronRight className="h-4 w-4 text-indigo-500 shrink-0" />
                      <p className="text-xs font-semibold text-indigo-700">
                        <span className="font-bold">
                          {remainingCount} objective
                          {remainingCount > 1 ? "s" : ""}
                        </span>{" "}
                        remaining before you're ready for{" "}
                        <span className="font-bold">
                          {nextLevel.label} level
                        </span>
                      </p>
                    </div>
                  ) : remainingCount === 0 && nextLevel ? (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <p className="text-xs font-bold text-emerald-700 flex flex-wrap items-center gap-1">
                        All objectives complete! Ready to step up to{" "}
                        <span className="flex items-center gap-1">
                          {nextLevel.label} level{" "}
                          <PartyPopper className="h-3.5 w-3.5 text-emerald-600 mb-0.5" />
                        </span>
                      </p>
                    </div>
                  ) : remainingCount === 0 && !nextLevel ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-rose-500 shrink-0" />
                      <p className="text-xs font-bold text-rose-700 flex items-center gap-1">
                        Peak achieved — {currentLevelData?.label}!{" "}
                        <Trophy className="h-3.5 w-3.5 text-rose-600 mb-0.5" />
                      </p>
                    </div>
                  ) : null}

                  {/* Trajectory insight */}
                  {nextLevel && nextLevel.ageRange && (
                    <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <p className="text-[11px] text-amber-700">
                        <span className="font-bold">{nextLevel.label}</span>{" "}
                        athletes are typically{" "}
                        <span className="font-bold">{nextLevel.ageRange}</span>{" "}
                        — plan accordingly.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

