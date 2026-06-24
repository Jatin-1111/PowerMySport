"use client";

import { cn } from "@/utils/cn";
import { motion, Variants } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Compass,
  LucideIcon,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { SectionLabel } from "./SectionLabel";

// ─── Types ──────────────────────────────────────────────────────────────────

type Accent = "orange" | "blue" | "emerald" | "indigo";

interface Phase {
  status: "live" | "upcoming";
  tag: string;
  name: string;
  title: string;
  description: string;
  bullets: string[];
  icon: LucideIcon;
  accent: Accent;
  cta?: { label: string; href: string }[];
}

// ─── Single source of truth for the phased rollout ───────────────────────────
//
// Keep this in sync with the product roadmap. Marketing pages import this so the
// "what's live / what's coming" story stays identical everywhere.

export const ROLLOUT_PHASES: Phase[] = [
  {
    status: "live",
    tag: "Available Now",
    name: "Explore",
    title: "Your child's sports roadmap & guidance",
    description:
      "Tell us about your child and get a clear, step-by-step plan for their sport — plus AI and expert guidance on what to do next. No more guessing where to start.",
    bullets: [
      "A personalised roadmap for your child's sport",
      "AI + expert guidance, on call",
      "Understand the path before you spend a single rupee",
    ],
    icon: Compass,
    accent: "orange",
    cta: [
      { label: "Build a Sports Plan", href: "/roadmap" },
      { label: "Get Free Guidance", href: "/guidance" },
    ],
  },
  {
    status: "upcoming",
    tag: "Phase 1",
    name: "Community",
    title: "Talk to parents who've been there",
    description:
      "Connect with parents in your own city. Ask real questions, read honest reviews, and learn what actually works — before you decide anything.",
    bullets: [
      "Honest reviews from local parents",
      "Ask questions, get real answers",
      "Trusted recommendations near you",
    ],
    icon: Users,
    accent: "blue",
  },
  {
    status: "upcoming",
    tag: "Phase 2",
    name: "Booking",
    title: "Book trusted coaches & venues",
    description:
      "Find and book verified coaches, venues, and academies in a few taps. Clear pricing and instant confirmation — no more endless phone calls.",
    bullets: [
      "Verified coaches and venues",
      "Transparent pricing, no surprises",
      "Book in a few taps",
    ],
    icon: CalendarCheck,
    accent: "emerald",
  },
  {
    status: "upcoming",
    tag: "Phase 3",
    name: "Shop",
    title: "The right gear, made simple",
    description:
      "Buy the right equipment for your child's sport — picked for their age and level, and delivered to your door. No guesswork at the store.",
    bullets: [
      "Gear matched to your child's sport",
      "Recommended for their age & level",
      "Delivered to your door",
    ],
    icon: ShoppingBag,
    accent: "indigo",
  },
];

// ─── Accent styling ───────────────────────────────────────────────────────────

const accentStyles: Record<
  Accent,
  {
    dot: string;
    iconBox: string;
    badge: string;
    glow: string;
    check: string;
  }
> = {
  orange: {
    dot: "bg-power-orange",
    iconBox: "bg-orange-100 text-power-orange",
    badge: "bg-orange-50 text-power-orange border-orange-200/80",
    glow: "from-orange-400/20",
    check: "text-power-orange",
  },
  blue: {
    dot: "bg-blue-500",
    iconBox: "bg-blue-100 text-blue-600",
    badge: "bg-blue-50 text-blue-700 border-blue-200/80",
    glow: "from-blue-400/15",
    check: "text-blue-500",
  },
  emerald: {
    dot: "bg-emerald-500",
    iconBox: "bg-emerald-100 text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    glow: "from-emerald-400/15",
    check: "text-emerald-500",
  },
  indigo: {
    dot: "bg-indigo-500",
    iconBox: "bg-indigo-100 text-indigo-600",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    glow: "from-indigo-400/15",
    check: "text-indigo-500",
  },
};

// ─── Motion variants ───────────────────────────────────────────────────────────

const sectionVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const headerVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 22 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 250, damping: 24 },
  },
};

// ─── Phase Row ─────────────────────────────────────────────────────────────────

function PhaseRow({ phase, isLast }: { phase: Phase; isLast: boolean }) {
  const s = accentStyles[phase.accent];
  const Icon = phase.icon;
  const isLive = phase.status === "live";

  return (
    <motion.div variants={rowVariants} className="relative flex gap-5 sm:gap-7">
      {/* Timeline rail (dot + connecting line) */}
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm",
            s.iconBox,
          )}
        >
          <Icon className="h-5 w-5" />
          {isLive && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-power-orange opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-power-orange ring-2 ring-white" />
            </span>
          )}
        </span>
        {!isLast && (
          <span
            aria-hidden
            className="mt-2 w-px grow rounded-full bg-gradient-to-b from-slate-200 to-slate-200/0"
          />
        )}
      </div>

      {/* Card */}
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 280, damping: 20 }}
        className={cn(
          "group relative mb-8 flex-1 overflow-hidden rounded-2xl border p-6 backdrop-blur-sm will-change-transform sm:p-7",
          isLive
            ? "border-power-orange/30 bg-white/90 premium-shadow"
            : "border-white/70 bg-white/70 shadow-sm hover:bg-white/85",
        )}
      >
        {/* Soft corner glow */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-bl to-transparent blur-2xl",
            s.glow,
          )}
        />

        <div className="relative">
          {/* Tag row */}
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]",
                s.badge,
              )}
            >
              {phase.tag}
            </span>
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                Coming Soon
              </span>
            )}
          </div>

          <h3 className="font-title mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
            {phase.name}
          </h3>
          <p className="mb-3 text-xl font-bold text-slate-900 sm:text-2xl">
            {phase.title}
          </p>
          <p className="mb-5 text-sm leading-relaxed text-slate-600 sm:text-base">
            {phase.description}
          </p>

          <ul className="grid gap-2 sm:grid-cols-2">
            {phase.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-sm text-slate-600"
              >
                <Check className={cn("mt-0.5 h-4 w-4 shrink-0", s.check)} />
                {b}
              </li>
            ))}
          </ul>

          {phase.cta && phase.cta.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {phase.cta.map((c, i) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={cn(
                    "group/btn inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                    i === 0
                      ? "bg-power-orange text-white shadow-[0_8px_24px_-8px_rgba(233,115,22,0.55)] hover:bg-orange-600"
                      : "border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {c.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export interface RolloutRoadmapProps {
  title?: string;
  subtitle?: string;
  description?: string;
  className?: string;
}

export function RolloutRoadmap({
  title = "What's live today — and what's coming next",
  subtitle = "Our Rollout Plan",
  description = "We're building PowerMySport step by step, so every part is genuinely useful from day one. Here's exactly where we are and what's on the way.",
  className,
}: RolloutRoadmapProps) {
  return (
    <section className={cn("relative overflow-hidden py-16 sm:py-20 lg:py-24", className)}>
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-orange-100/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-blue-100/25 blur-3xl" />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-12 text-center sm:mb-14"
        >
          <motion.div variants={headerVariants} className="mb-4 flex justify-center">
            <SectionLabel label={subtitle} color="orange" />
          </motion.div>
          <motion.h2
            variants={headerVariants}
            className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
          >
            {title}
          </motion.h2>
          <motion.p
            variants={headerVariants}
            className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg"
          >
            {description}
          </motion.p>
        </motion.div>

        {/* Timeline */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          {ROLLOUT_PHASES.map((phase, i) => (
            <PhaseRow
              key={phase.name}
              phase={phase}
              isLast={i === ROLLOUT_PHASES.length - 1}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
