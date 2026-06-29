"use client";

import { Eye, Star } from "lucide-react";
import { motion } from "framer-motion";

export function TalentIdentifiersCard({ identifiers }: { identifiers: string[] }) {
  if (!identifiers.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-5"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 border border-amber-200">
          <Eye className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-amber-900">Talent Indicators to Watch</h3>
          <p className="text-[10px] text-amber-700 font-semibold">Observable signs of genuine aptitude</p>
        </div>
      </div>
      <ul className="space-y-2">
        {identifiers.map((id, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Star className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
            {id}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
