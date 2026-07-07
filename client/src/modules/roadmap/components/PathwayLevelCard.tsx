"use client";

import {
    MacroLevel,
    mergeAgeRanges,
} from "@/modules/sports/config/macroLevels";
import { motion } from "framer-motion";
import {
    ChevronDown,
    Pin,
} from "lucide-react";

import {
    SPRING_STIFF,
    cardReveal
} from '../config/constants';

// ─── Dynamic pathway level card ────────────────────────────────────────────────

export function PathwayLevelCard({
  macroLevel,
  isActive,
  onClick,
  isCurrentLevel,
  completedSteps = 0,
  totalSteps = 0,
}: {
  macroLevel: MacroLevel;
  isActive: boolean;
  onClick: () => void;
  isCurrentLevel?: boolean;
  completedSteps?: number;
  totalSteps?: number;
}) {
  const colors = macroLevel;
  const completionPct =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  // A single keyFocus line to preview — prefer the "leading edge" raw level.
  const previewFocus =
    macroLevel.rawLevels[macroLevel.rawLevels.length - 1]?.keyFocus;
  const ageRange = mergeAgeRanges(macroLevel.rawLevels.map((l) => l.ageRange));
  return (
    <motion.button
      variants={cardReveal}
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={SPRING_STIFF}
      className={`group relative w-full overflow-hidden rounded-2xl border text-left transition-all duration-300 will-change-transform ${
        isActive
          ? `bg-gradient-to-br ${colors.bg} ${colors.border} shadow-lg`
          : "border-white/70 bg-white/80 backdrop-blur-sm hover:border-white/90 hover:bg-white/90 premium-shadow"
      }`}
    >
      {/* Left accent stripe when active */}
      {isActive && (
        <div
          className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${colors.gradient}`}
        />
      )}

      <div className={`flex items-center gap-3 p-4 ${isActive ? "pl-5" : ""}`}>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${colors.gradient} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
        >
          {macroLevel.icon}
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <p
            className={`text-[10px] font-bold uppercase tracking-widest ${colors.text}`}
          >
            {macroLevel.scopeTag}
          </p>
          <p className="font-bold text-slate-900 text-sm">{macroLevel.label}</p>
          {previewFocus && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-snug">
              {previewFocus}
            </p>
          )}
          {ageRange && (
            <p className="mt-0.5 text-[10px] text-slate-400">{ageRange}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isCurrentLevel && (
            <span className="hidden sm:flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[9px] font-bold text-amber-700">
              <Pin className="h-2.5 w-2.5" /> HERE
            </span>
          )}
          {totalSteps > 0 && (
            <span className={`text-[10px] font-semibold ${colors.text}`}>
              {completedSteps}/{totalSteps}
            </span>
          )}
          <motion.div
            animate={{ rotate: isActive ? 180 : 0 }}
            transition={{ duration: 0.22 }}
            className={`lg:hidden ${colors.text}`}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>
      </div>

      {/* Completion progress bar */}
      {totalSteps > 0 && (
        <div className={`px-4 pb-3 ${isActive ? "pl-5" : ""}`}>
          <div className="h-1 w-full rounded-full bg-slate-200/70 overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${colors.gradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${completionPct}%` }}
              transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            />
          </div>
          {completedSteps === totalSteps && totalSteps > 0 && (
            <p className={`mt-1 text-[10px] font-bold ${colors.text}`}>
              All done!
            </p>
          )}
        </div>
      )}
    </motion.button>
  );
}

