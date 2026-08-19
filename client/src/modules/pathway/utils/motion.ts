import type { Variants } from "framer-motion";

// ─── Motion tokens ───────────────────────────────────────────────────────────
//
// The roadmap page's existing motion vocabulary, kept byte-for-byte from the
// tokens it used before the pathway rebuild so the section reveals still feel
// identical to the rest of the marketing site.

export const SPRING_STIFF = {
  type: "spring",
  stiffness: 260,
  damping: 22,
} as const;

export const orchestrator: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.06 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: SPRING_STIFF },
};

export const cardReveal: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_STIFF },
};
