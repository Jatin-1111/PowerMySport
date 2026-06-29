"use client";

import { Brain } from "lucide-react";
import { motion } from "framer-motion";
import type { GuidanceResponse } from "../../types";

export function MentalSkillsCard({ roadmap }: { roadmap: NonNullable<GuidanceResponse["mentalSkillsRoadmap"]> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-200 bg-white p-5"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 border border-violet-200">
          <Brain className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="font-title font-bold text-slate-900">Mental Skills Roadmap</h3>
          <p className="text-xs text-violet-600 font-semibold">Right now: {roadmap.currentFocus}</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {roadmap.skills.map((s, i) => (
          <div key={i} className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
            <p className="text-xs font-bold text-violet-800 mb-1">{s.skill}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{s.howToDevelop}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
