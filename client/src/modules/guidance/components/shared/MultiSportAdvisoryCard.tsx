"use client";

import { Layers } from "lucide-react";
import { motion } from "framer-motion";

export function MultiSportAdvisoryCard({ advisory }: { advisory: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-indigo-50 p-5"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 border border-sky-200">
          <Layers className="h-5 w-5 text-sky-600" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-sky-900">Multi-Sport Advisory</h3>
          <p className="text-[10px] text-sky-600 font-semibold">Recommended for under-12</p>
        </div>
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{advisory}</p>
    </motion.div>
  );
}
