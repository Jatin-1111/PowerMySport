"use client";

import { cn } from "@/utils/cn";
import {
    animate,
    motion,
    useInView,
    useMotionValue,
    Variants,
} from "framer-motion";
import React, { useEffect, useRef } from "react";

export interface Stat {
  value: string;
  label: string;
  description?: string;
}

export interface StatsProps {
  stats: Stat[];
  variant?: "default" | "gradient";
  columns?: 2 | 3 | 4;
}

// ─── Motion variants ──────────────────────────────────────────────────────────

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const statVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

// ─── Animated number: detects if value is numeric and animates from 0 ─────────

function AnimatedStatValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  // Try to parse a numeric portion from strings like "10K+", "98%", "4.9", "0%"
  const match = value.match(/^([\d.]+)(.*)$/);
  const numericPart = match ? parseFloat(match[1]) : null;
  const suffix = match ? match[2] : "";

  const motionVal = useMotionValue(0);

  useEffect(() => {
    if (isInView && numericPart !== null) {
      const controls = animate(motionVal, numericPart, {
        duration: 1.6,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (latest) => {
          if (ref.current) {
            const formatted =
              numericPart % 1 === 0
                ? Math.round(latest).toString()
                : latest.toFixed(1);
            ref.current.textContent = `${formatted}${suffix}`;
          }
        },
      });
      return () => controls.stop();
    }
  }, [isInView, numericPart, suffix, motionVal]);

  return (
    <span ref={ref} className={className}>
      {numericPart !== null ? `0${suffix}` : value}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export const Stats: React.FC<StatsProps> = ({
  stats,
  variant = "default",
  columns = 4,
}) => {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  const isGradient = variant === "gradient";

  return (
    <section
      className={cn(
        "relative overflow-hidden py-16 sm:py-20 lg:py-24",
        isGradient
          ? "bg-gradient-to-br from-power-orange via-amber-500 to-turf-green"
          : "bg-slate-50/60",
      )}
    >
      {/* Ambient overlays */}
      {isGradient && (
        <>
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        </>
      )}

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className={cn("grid gap-8", gridCols[columns])}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              variants={statVariants}
              className={cn(
                "text-center",
                !isGradient &&
                  "rounded-2xl border border-white/70 bg-white/80 px-6 py-8 backdrop-blur-sm premium-shadow",
              )}
            >
              <AnimatedStatValue
                value={stat.value}
                className={cn(
                  "text-4xl font-bold sm:text-5xl",
                  isGradient ? "text-white" : "text-power-orange",
                )}
              />
              <div
                className={cn(
                  "mt-2 text-lg font-semibold",
                  isGradient ? "text-white" : "text-slate-900",
                )}
              >
                {stat.label}
              </div>
              {stat.description && (
                <div
                  className={cn(
                    "mt-1 text-sm",
                    isGradient ? "text-white/80" : "text-slate-500",
                  )}
                >
                  {stat.description}
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
