"use client";

import { Crosshair, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import type { GoalAssessment } from "../../types";

const VERDICT_STYLE: Record<
  GoalAssessment["verdict"],
  { badge: string; ring: string; icon: string; bg: string }
> = {
  "On Track": {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ring: "border-emerald-200",
    icon: "text-emerald-600",
    bg: "bg-emerald-50/60",
  },
  Achievable: {
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    ring: "border-sky-200",
    icon: "text-sky-600",
    bg: "bg-sky-50/60",
  },
  Ambitious: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "border-amber-200",
    icon: "text-amber-600",
    bg: "bg-amber-50/60",
  },
  "Long-Term": {
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    ring: "border-violet-200",
    icon: "text-violet-600",
    bg: "bg-violet-50/60",
  },
};

export function GoalAssessmentCard({ a }: { a: GoalAssessment }) {
  const cfg = VERDICT_STYLE[a.verdict] ?? VERDICT_STYLE.Achievable;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${cfg.ring} ${cfg.bg} p-4`}
    >
      <div className="mb-2 flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border bg-white/80 ${cfg.ring}`}>
          <Crosshair className={`h-5 w-5 ${cfg.icon}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Goal check
          </p>
          <h4 className="truncate text-sm font-bold text-slate-900">
            {a.statedGoal}
          </h4>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}
        >
          {a.verdict}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-slate-700">{a.rationale}</p>
      <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-white bg-white/70 px-3 py-2">
        <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-[11px] text-slate-600">
          <span className="font-bold text-slate-700">Benchmark:</span> {a.benchmark}
        </p>
      </div>
    </motion.div>
  );
}
