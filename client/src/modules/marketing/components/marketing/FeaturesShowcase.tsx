"use client";

import { cn } from "@/utils/cn";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";
import { SectionLabel } from "./SectionLabel";

export interface ShowcaseFeature {
  title: string;
  description: string;
  icon?: React.ReactNode;
  label?: string;
  stat?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

interface FeaturesShowcaseProps {
  title?: string;
  subtitle?: string;
  description?: string;
  features: ShowcaseFeature[];
}

// ─── Per-feature color palette ─────────────────────────────────────────────────
const PALETTE = [
  {
    dot: "bg-power-orange",
    chip: "bg-orange-100 text-orange-700 ring-orange-200",
    iconBg: "bg-orange-50 text-power-orange ring-1 ring-orange-200",
    numColor: "text-power-orange",
    stepHex: "#FED7AA",
    glowColor: "rgba(249,115,22,0.12)",
    progressBar: "bg-power-orange",
    cardAccentFrom: "from-orange-50/60",
  },
  {
    dot: "bg-blue-500",
    chip: "bg-blue-100 text-blue-700 ring-blue-200",
    iconBg: "bg-blue-50 text-blue-600 ring-1 ring-blue-200",
    numColor: "text-blue-600",
    stepHex: "#BFDBFE",
    glowColor: "rgba(59,130,246,0.12)",
    progressBar: "bg-blue-500",
    cardAccentFrom: "from-blue-50/60",
  },
  {
    dot: "bg-violet-500",
    chip: "bg-violet-100 text-violet-700 ring-violet-200",
    iconBg: "bg-violet-50 text-violet-600 ring-1 ring-violet-200",
    numColor: "text-violet-600",
    stepHex: "#DDD6FE",
    glowColor: "rgba(124,58,237,0.12)",
    progressBar: "bg-violet-500",
    cardAccentFrom: "from-violet-50/60",
  },
  {
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    iconBg: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200",
    numColor: "text-emerald-600",
    stepHex: "#A7F3D0",
    glowColor: "rgba(16,185,129,0.12)",
    progressBar: "bg-emerald-500",
    cardAccentFrom: "from-emerald-50/60",
  },
  {
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700 ring-amber-200",
    iconBg: "bg-amber-50 text-amber-600 ring-1 ring-amber-200",
    numColor: "text-amber-600",
    stepHex: "#FDE68A",
    glowColor: "rgba(245,158,11,0.12)",
    progressBar: "bg-amber-500",
    cardAccentFrom: "from-amber-50/60",
  },
  {
    dot: "bg-rose-500",
    chip: "bg-rose-100 text-rose-700 ring-rose-200",
    iconBg: "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
    numColor: "text-rose-600",
    stepHex: "#FECDD3",
    glowColor: "rgba(244,63,94,0.12)",
    progressBar: "bg-rose-500",
    cardAccentFrom: "from-rose-50/60",
  },
];

const STEPS = ["01", "02", "03", "04", "05", "06", "07", "08"];

const sectionVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 22 },
  },
};

// ─── Mini abstract visuals per feature ────────────────────────────────────────
// Pure CSS / JSX visuals — no images needed.

function MiniRoadmap({ color }: { color: string }) {
  const nodes = ["Age 7", "Age 9", "Age 11", "Compete"];
  return (
    <div className="flex items-center gap-2">
      {nodes.map((n, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold",
                i === 0 ? color + " text-white" : "bg-slate-100 text-slate-400"
              )}
            >
              {i + 1}
            </div>
            <span className="text-[9px] text-slate-400">{n}</span>
          </div>
          {i < nodes.length - 1 && (
            <div className="mb-4 h-px flex-1 border-t border-dashed border-slate-200" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function MiniSteps({ dotColor }: { dotColor: string }) {
  const steps = ["First session", "Build basics", "Join a team", "First tournament"];
  return (
    <div className="flex flex-col gap-2">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
              i === 0 ? dotColor : "bg-slate-200"
            )}
          >
            {i + 1}
          </div>
          <div className={cn("h-1.5 flex-1 rounded-full", i === 0 ? dotColor + " opacity-70" : "bg-slate-100")} />
          <span className={cn("text-[10px]", i === 0 ? "font-semibold text-slate-600" : "text-slate-400")}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function MiniChat({ chipCls }: { chipCls: string }) {
  const bubbles = [
    { q: "Is tennis right for my 8-year-old?", isUser: true },
    { q: "Yes — here's a personalised 3-month plan", isUser: false },
  ];
  return (
    <div className="flex flex-col gap-2">
      {bubbles.map((b, i) => (
        <div key={i} className={cn("flex", b.isUser ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[80%] rounded-2xl px-3 py-2 text-[10px] leading-tight",
              b.isUser
                ? "bg-slate-100 text-slate-600"
                : cn(chipCls, "font-medium")
            )}
          >
            {b.q}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniMilestones({ dotColor }: { dotColor: string }) {
  const items = ["District Level", "State Level", "National Circuit", "Pro Track"];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((label, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-2",
            i === 0 ? "border-transparent bg-slate-100" : "border-slate-100 bg-white"
          )}
        >
          <div className={cn("h-2 w-2 rounded-full shrink-0", i === 0 ? dotColor : "bg-slate-300")} />
          <span className={cn("text-[10px] font-medium", i === 0 ? "text-slate-700" : "text-slate-400")}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function MiniDashboard({ dotColor }: { dotColor: string }) {
  const stats = [
    { label: "Roadmap", val: "Active" },
    { label: "Guidance", val: "3 Q&A" },
    { label: "Next Step", val: "Today" },
    { label: "Progress", val: "68%" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((s, i) => (
        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
          <p className={cn("text-sm font-bold", i === 0 ? dotColor.replace("bg-", "text-") : "text-slate-700")}>{s.val}</p>
        </div>
      ))}
    </div>
  );
}

function MiniBudget() {
  const bars = [40, 65, 30, 80, 50];
  return (
    <div className="flex items-end gap-2 pt-2">
      {bars.map((h, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={cn("w-full rounded-t-sm transition-all", i === 3 ? "bg-power-orange" : "bg-slate-200")}
            style={{ height: `${h * 0.6}px` }}
          />
          <span className="text-[8px] text-slate-400">{["Jan", "Feb", "Mar", "Apr", "May"][i]}</span>
        </div>
      ))}
    </div>
  );
}

const VISUALS = [MiniRoadmap, MiniSteps, MiniChat, MiniMilestones, MiniDashboard, MiniBudget];

// ─── Main component ────────────────────────────────────────────────────────────

export const FeaturesShowcase: React.FC<FeaturesShowcaseProps> = ({
  title,
  subtitle,
  description,
  features,
}) => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 5 s, paused on hover
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(id);
  }, [paused, features.length]);

  const feature = features[active];
  const pal = PALETTE[active % PALETTE.length];
  const Visual = VISUALS[active % VISUALS.length];

  return (
    <section className="relative py-16 sm:py-20 lg:py-24">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-100/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-64 translate-x-1/2 rounded-full bg-orange-100/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Section header ── */}
        {(title || subtitle || description) && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-12 sm:mb-16"
          >
            {subtitle && (
              <motion.div variants={itemVariants} className="mb-4">
                <SectionLabel label={subtitle} color="orange" />
              </motion.div>
            )}
            {title && (
              <motion.h2
                variants={itemVariants}
                className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
              >
                {title}
              </motion.h2>
            )}
            {description && (
              <motion.p
                variants={itemVariants}
                className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg"
              >
                {description}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* ── Two-panel layout ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.15 }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr] lg:gap-6 xl:grid-cols-[400px_1fr]"
        >
          {/* ── Left: Parent worry list ── */}
          <div className="flex flex-col gap-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Parents ask us…
            </p>

            {features.map((f, i) => {
              const p = PALETTE[i % PALETTE.length];
              const isActive = i === active;
              return (
                <button
                  key={i}
                  onClick={() => { setActive(i); setPaused(true); }}
                  className={cn(
                    "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl border p-3.5 text-left transition-all duration-200",
                    isActive
                      ? "border-slate-200 bg-white shadow-[0_2px_16px_-2px_rgba(0,0,0,0.08)]"
                      : "border-transparent bg-white/50 hover:border-slate-100 hover:bg-white hover:shadow-sm"
                  )}
                >
                  {/* Colored active bar (left edge) */}
                  {isActive && (
                    <motion.div
                      layoutId="activeBar"
                      className={cn(
                        "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                        p.dot
                      )}
                      transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    />
                  )}

                  {/* Step number */}
                  <span
                    className={cn(
                      "shrink-0 text-sm font-bold tabular-nums transition-colors duration-200",
                      isActive ? p.numColor : "text-slate-300 group-hover:text-slate-400"
                    )}
                  >
                    {STEPS[i]}
                  </span>

                  {/* Icon */}
                  {f.icon && (
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                        isActive
                          ? p.iconBg
                          : "bg-slate-100 text-slate-400"
                      )}
                    >
                      {f.icon}
                    </span>
                  )}

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[11px] font-medium leading-snug transition-colors duration-200",
                        isActive ? p.numColor : "text-slate-400 group-hover:text-slate-500"
                      )}
                    >
                      &ldquo;{f.label}&rdquo;
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm font-semibold leading-snug transition-colors duration-200",
                        isActive ? "text-slate-900" : "text-slate-500 group-hover:text-slate-700"
                      )}
                    >
                      {f.title}
                    </p>
                  </div>

                  {/* Chevron */}
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-200",
                      isActive
                        ? cn(p.numColor, "opacity-100")
                        : "text-slate-300 opacity-0 group-hover:opacity-100"
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* ── Right: Solution showcase ── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 14, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "relative flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-slate-100",
                "bg-gradient-to-br lg:min-h-0 lg:h-full",
                "from-white to-slate-50/40",
                "shadow-[0_4px_32px_-4px_rgba(0,0,0,0.09)]"
              )}
            >
              {/* Top accent bar */}
              <div className={cn("h-1 w-full shrink-0", pal.dot)} />

              {/* Radial glow top-right */}
              <div
                className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full"
                style={{
                  background: `radial-gradient(circle at 100% 0%, ${pal.glowColor}, transparent 65%)`,
                }}
              />

              {/* Big decorative step number */}
              <div
                className="pointer-events-none absolute right-3 top-0 select-none text-[9rem] font-black leading-none"
                style={{ color: pal.stepHex, opacity: 0.55 }}
              >
                {STEPS[active]}
              </div>

              <div className="relative z-10 flex h-full flex-col p-7 sm:p-9">
                {/* Top: worry chip + stat badge */}
                <div className="mb-8 flex flex-wrap items-start gap-3">
                  {feature.label && (
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
                        pal.chip
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", pal.dot)} />
                      {feature.label}
                    </motion.span>
                  )}

                  {feature.stat && (
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm"
                    >
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      {feature.stat}
                    </motion.span>
                  )}
                </div>

                {/* Icon */}
                {feature.icon && (
                  <motion.div
                    initial={{ scale: 0.75, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.07, type: "spring", stiffness: 320, damping: 20 }}
                    className={cn(
                      "mb-6 flex h-14 w-14 items-center justify-center rounded-2xl [&_svg]:h-6 [&_svg]:w-6",
                      pal.iconBg
                    )}
                  >
                    {feature.icon}
                  </motion.div>
                )}

                {/* Title */}
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-4 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl"
                >
                  {feature.title}
                </motion.h3>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                  className="max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg"
                >
                  {feature.description}
                </motion.p>

                {/* Mini visual */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-8 rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm backdrop-blur-sm"
                >
                  <Visual
                    color={pal.dot}
                    dotColor={pal.dot}
                    chipCls={pal.chip}
                  />
                </motion.div>

                {/* Bottom: progress dots + counter */}
                <div className="mt-auto flex items-center justify-between pt-6">
                  <div className="flex items-center gap-1.5">
                    {features.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setActive(i); setPaused(true); }}
                        aria-label={`Go to feature ${i + 1}`}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          i === active
                            ? cn("w-6", pal.progressBar)
                            : "w-1.5 bg-slate-200 hover:bg-slate-300"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium tabular-nums text-slate-300">
                    {STEPS[active]}&nbsp;/&nbsp;{String(features.length).padStart(2, "0")}
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};
