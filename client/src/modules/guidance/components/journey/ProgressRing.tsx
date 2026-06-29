"use client";

import { motion } from "framer-motion";

export function ProgressRing({ percent, dark }: { percent: number; dark?: boolean }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="h-[72px] w-[72px] -rotate-90">
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={dark ? "rgba(255,255,255,0.14)" : "rgb(241 245 249)"}
          strokeWidth="7"
        />
        <motion.circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="url(#journeyGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * percent) / 100 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: "drop-shadow(0 0 4px rgba(233,115,22,0.5))" }}
        />
        <defs>
          <linearGradient id="journeyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e97316" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-base font-black ${dark ? "text-white" : "text-slate-800"}`}>
          {percent}%
        </span>
      </div>
    </div>
  );
}
