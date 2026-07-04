"use client";

import { CheckCircle2, AlertCircle, Clock, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { GoalAssessment } from "../../types";

const VERDICT_CONFIG: Record<
  GoalAssessment["verdict"],
  { icon: typeof CheckCircle2; color: string; bg: string; border: string; badge: string; headline: string }
> = {
  "On Track": {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    headline: "Great timing — start now",
  },
  Achievable: {
    icon: CheckCircle2,
    color: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    badge: "bg-sky-100 text-sky-700",
    headline: "Good fit for your child",
  },
  Ambitious: {
    icon: AlertCircle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    headline: "Possible — needs commitment",
  },
  "Long-Term": {
    icon: Clock,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    badge: "bg-violet-100 text-violet-700",
    headline: "Long road — plan carefully",
  },
};

interface LevelContext {
  sport: string;
  levelLabel: string;
  roadmapHref: string;
}

export function VerdictHero({
  assessment,
  levelContext,
}: {
  assessment: GoalAssessment;
  levelContext?: LevelContext;
}) {
  const cfg = VERDICT_CONFIG[assessment.verdict] ?? VERDICT_CONFIG.Achievable;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-5 sm:p-6`}
    >
      {levelContext && (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-current/10 pb-3">
          <p className="text-xs font-semibold text-slate-500">
            Continuing your <span className="text-slate-800">{levelContext.sport}</span> pathway research
          </p>
          <Link
            href={levelContext.roadmapHref}
            className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-power-orange transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to roadmap
          </Link>
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white border ${cfg.border}`}>
          <Icon className={`h-6 w-6 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
            {levelContext
              ? `Should your child play ${levelContext.sport} at ${levelContext.levelLabel} level?`
              : "Your goal check"}
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="font-title text-xl font-bold text-slate-900">{cfg.headline}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}>
              {assessment.verdict}
            </span>
          </div>
          {!levelContext && (
            <p className="mb-2 text-xs font-medium text-slate-500">{assessment.statedGoal}</p>
          )}
          <p className="text-sm text-slate-700 leading-relaxed">{assessment.rationale}</p>
          <div className="mt-3 rounded-xl bg-white/80 border border-white/60 px-3 py-2.5">
            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-700">Benchmark: </span>
              {assessment.benchmark}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
