"use client";

import { Award } from "lucide-react";
import { motion } from "framer-motion";

export function AchievementToast({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -10 }}
      className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-lg"
    >
      <Award className="h-4 w-4 text-amber-600" />
      {label}
    </motion.div>
  );
}
