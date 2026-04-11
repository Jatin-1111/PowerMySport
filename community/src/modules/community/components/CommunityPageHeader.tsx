"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type CommunityPageHeaderProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
};

export function CommunityPageHeader({
  title,
  subtitle,
  badge,
  action,
}: CommunityPageHeaderProps) {
  const prefersReducedMotion = useReducedMotion();
  const cardTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.45, ease: "easeOut" as const };

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={cardTransition}
      className="relative overflow-hidden rounded-[2rem] border border-slate-700/30 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(15,23,42,0.88)_48%,rgba(233,115,22,0.18)_100%)] p-6 text-white shadow-[0_24px_70px_-35px_rgba(15,23,42,0.8)] sm:p-8"
    >
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/80 backdrop-blur">
              {badge}
            </span>
          )}
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200/90 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <motion.div
        aria-hidden="true"
        animate={
          prefersReducedMotion
            ? { opacity: 0.45 }
            : { x: [0, -8, 0], y: [0, 8, 0], opacity: 0.45 }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : {
                duration: 14,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
        className="pointer-events-none absolute -right-24 -top-20 h-56 w-56 rounded-full bg-power-orange/30 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        animate={
          prefersReducedMotion
            ? { opacity: 0.3 }
            : { x: [0, 10, 0], y: [0, -10, 0], opacity: 0.3 }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.01 }
            : {
                duration: 16,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
        className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-turf-green/25 blur-3xl"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_35%)]" />
    </motion.div>
  );
}
