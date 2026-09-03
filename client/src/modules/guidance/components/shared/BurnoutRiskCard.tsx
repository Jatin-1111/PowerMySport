"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { BurnoutRisk } from "../../types";

export function BurnoutRiskCard({ risk }: { risk: BurnoutRisk }) {
  if (risk.level === "low") return null;
  const cfg = {
    medium: {
      bg: "from-amber-50 to-orange-50",
      border: "border-amber-200",
      icon: "text-amber-600",
      title: "text-amber-900",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
    },
    high: {
      bg: "from-rose-50 to-red-50",
      border: "border-rose-300",
      icon: "text-rose-600",
      title: "text-rose-900",
      badge: "bg-rose-100 text-rose-700 border-rose-200",
    },
  }[risk.level];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-5 shadow-sm sm:p-6`}
    >
      <div className="mb-5 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white/80 ${cfg.border}`}
        >
          <AlertTriangle className={`h-5 w-5 ${cfg.icon}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-title text-lg leading-tight font-bold ${cfg.title}`}>
              Burnout Risk Alert
            </h3>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${cfg.badge}`}
            >
              {risk.level === "high" ? "High Risk" : "Monitor"}
            </span>
          </div>
          <p className={`mt-0.5 text-xs ${cfg.title} opacity-80`}>{risk.message}</p>
        </div>
      </div>
      {risk.recommendations.length > 0 && (
        <ul className="space-y-1.5">
          {risk.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-white/70 ${cfg.border}`}
              >
                <span className={`text-[9px] font-black ${cfg.icon}`}>{i + 1}</span>
              </div>
              {r}
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}
