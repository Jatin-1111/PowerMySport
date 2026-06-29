"use client";

import { motion } from "framer-motion";

export function CelebrationBurst() {
  const bits = Array.from({ length: 30 });
  const colors = [
    "bg-power-orange",
    "bg-emerald-400",
    "bg-amber-400",
    "bg-sky-400",
    "bg-violet-400",
    "bg-rose-400",
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
      {bits.map((_, i) => {
        const angle = (i / bits.length) * Math.PI * 2 + (i % 3) * 0.4;
        const dist = 90 + (i % 6) * 30;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 20,
              scale: 0.2,
              rotate: i % 2 ? 220 : -220,
            }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className={`absolute ${i % 2 ? "h-3 w-1.5" : "h-2.5 w-2.5"} rounded-sm ${colors[i % colors.length]}`}
          />
        );
      })}
    </div>
  );
}
