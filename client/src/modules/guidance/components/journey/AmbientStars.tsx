"use client";

import { motion } from "framer-motion";

export function AmbientStars() {
  const stars = [
    { top: "14%", left: "8%", d: 0, s: 2 },
    { top: "30%", left: "22%", d: 0.6, s: 1.5 },
    { top: "62%", left: "12%", d: 1.1, s: 2 },
    { top: "20%", left: "46%", d: 0.3, s: 1.5 },
    { top: "74%", left: "38%", d: 0.9, s: 1.5 },
    { top: "40%", left: "66%", d: 0.5, s: 2 },
    { top: "16%", left: "82%", d: 1.3, s: 1.5 },
    { top: "66%", left: "76%", d: 0.2, s: 2 },
    { top: "82%", left: "60%", d: 0.8, s: 1.5 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((st, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: st.top, left: st.left, width: st.s, height: st.s }}
          animate={{ opacity: [0.15, 0.9, 0.15], scale: [1, 1.4, 1] }}
          transition={{ repeat: Infinity, duration: 2.4, delay: st.d, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
