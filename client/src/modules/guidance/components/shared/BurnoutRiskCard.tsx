"use client";

import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
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
      className={`rounded-2xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-5`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 border ${cfg.border}`}>
          <AlertTriangle className={`h-5 w-5 ${cfg.icon}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-sm ${cfg.title}`}>Burnout Risk Alert</h3>
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}>
              {risk.level === "high" ? "High Risk" : "Monitor"}
            </span>
          </div>
          <p className={`text-xs mt-0.5 ${cfg.title} opacity-80`}>{risk.message}</p>
        </div>
      </div>
      {risk.recommendations.length > 0 && (
        <ul className="space-y-1.5">
          {risk.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
              <div className={`mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center rounded-full bg-white/70 border ${cfg.border}`}>
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
