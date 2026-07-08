"use client";

import { cn } from "@/utils/cn";
import { motion, Variants } from "framer-motion";
import {
    BarChart3,
    Calendar,
    CreditCard,
    MapPin,
    ShieldCheck,
    Star,
    Users,
    Zap,
} from "lucide-react";
import Image from "next/image";
import React from "react";
import { SectionLabel } from "./SectionLabel";

export interface Feature {
  title: string;
  description: string;
  icon?: React.ReactNode;
  label?: string;
  image?: string;
  stat?: string;
}

export interface FeaturesProps {
  title?: string;
  subtitle?: string;
  description?: string;
  features: Feature[];
  columns?: 2 | 3 | 4;
  variant?: "default" | "centered" | "bento";
}

// ─── Motion variants ───────────────────────────────────────────────────────────

const sectionVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const headerItemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 22 },
  },
};

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.18 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

// ─── Icon badge colors cycling ─────────────────────────────────────────────────

const iconBgColors = [
  "bg-orange-100 text-power-orange",
  "bg-blue-100 text-blue-600",
  "bg-emerald-100 text-emerald-600",
  "bg-purple-100 text-purple-600",
  "bg-amber-100 text-amber-600",
  "bg-cyan-100 text-cyan-600",
  "bg-rose-100 text-rose-600",
];

// ─── Feature Card ─────────────────────────────────────────────────────────────

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const colorClass = iconBgColors[index % iconBgColors.length];

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -8, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-md will-change-transform premium-shadow hover:border-white/90 hover:bg-white/90"
    >
      {/* Subtle corner accent */}
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-[3rem] opacity-40 bg-gradient-to-bl from-slate-100/80 to-transparent" />

      {/* Icon badge */}
      {feature.icon && (
        <motion.div
          className={cn(
            "mb-5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl will-change-transform",
            colorClass,
          )}
          whileHover={{ rotate: 8, scale: 1.18 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
        >
          {feature.icon}
        </motion.div>
      )}

      {/* Content */}
      {feature.label && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          {feature.label}
        </p>
      )}
      <h3 className="mb-2.5 text-lg font-bold text-slate-900">
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed text-slate-600">
        {feature.description}
      </p>

      {/* Bottom hover accent line */}
      <motion.div
        className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-power-orange/60 to-turf-green/40 origin-left"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </motion.div>
  );
}

// ─── Bento variant ─────────────────────────────────────────────────────────────

// One hero tile (2x2) + five equal tiles fills a 3-column grid with zero
// leftover cells (4 + 1*5 = 9 = 3x3) — any other split leaves an orphaned
// card dangling in its own row.
const bentoSpans = ["md:col-span-2 md:row-span-2", "", "", "", "", ""];

// On mobile these stack into one long column of near-identical dark photo
// cards — a distinct accent per card (icon chip + bottom edge) gives each
// one its own identity while scrolling, instead of six lookalike tiles.
const bentoAccents = [
  { chip: "bg-power-orange/25 ring-power-orange/40", edgeCls: "bg-gradient-to-r from-power-orange to-amber-400", glow: "249,115,22" },
  { chip: "bg-blue-500/25 ring-blue-400/40", edgeCls: "bg-gradient-to-r from-blue-500 to-cyan-400", glow: "96,165,250" },
  { chip: "bg-violet-500/25 ring-violet-400/40", edgeCls: "bg-gradient-to-r from-violet-500 to-purple-400", glow: "167,139,250" },
  { chip: "bg-emerald-500/25 ring-emerald-400/40", edgeCls: "bg-gradient-to-r from-emerald-500 to-teal-400", glow: "52,211,153" },
  { chip: "bg-amber-500/25 ring-amber-400/40", edgeCls: "bg-gradient-to-r from-amber-400 to-yellow-300", glow: "251,191,36" },
  { chip: "bg-rose-500/25 ring-rose-400/40", edgeCls: "bg-gradient-to-r from-rose-500 to-pink-400", glow: "251,113,133" },
];

function BentoFeatureCard({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
  const span = bentoSpans[index % bentoSpans.length];
  const isHero = span.includes("row-span-2");
  const accent = bentoAccents[index % bentoAccents.length];

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-3xl border border-white/10 will-change-transform md:min-h-0",
        "shadow-[0_8px_40px_-8px_rgba(0,0,0,0.45)]",
        "hover:shadow-[0_20px_60px_-8px_rgba(0,0,0,0.65)]",
        "transition-shadow duration-500",
        span,
      )}
    >
      {/* Background photo */}
      {feature.image && (
        <Image
          src={feature.image}
          alt=""
          aria-hidden="true"
          fill
          sizes={
            isHero
              ? "(min-width: 768px) 66vw, 100vw"
              : "(min-width: 768px) 33vw, 100vw"
          }
          className="scale-[1.04] object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.11]"
        />
      )}

      {/* Base gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/15" />

      {/* Per-card accent color glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% 110%, rgba(${accent.glow}, 0.2), transparent)`,
        }}
      />

      {/* Film grain for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "160px 160px",
        }}
      />

      {/* Top gradient accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-3xl", accent.edgeCls)} />

      {/* Floating stat pill — top right */}
      {feature.stat && (
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[11px] font-semibold tracking-wide text-white/85">
            {feature.stat}
          </span>
        </div>
      )}

      <div className="relative p-6 sm:p-7 md:p-8">
        {feature.icon && (
          <motion.div
            className={cn(
              "mb-5 flex shrink-0 items-center justify-center rounded-2xl text-white backdrop-blur-sm ring-1 will-change-transform",
              accent.chip,
              isHero ? "h-14 w-14" : "h-11 w-11",
            )}
            whileHover={{ rotate: 8, scale: 1.12 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
          >
            {feature.icon}
          </motion.div>
        )}

        {feature.label && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
            {feature.label}
          </p>
        )}

        <h3
          className={cn(
            "font-bold text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.4)]",
            isHero ? "mb-3 text-2xl sm:text-3xl" : "mb-2 text-lg sm:text-xl",
          )}
        >
          {feature.title}
        </h3>

        <p
          className={cn(
            "leading-relaxed text-white/75",
            isHero ? "text-base" : "text-sm line-clamp-3",
          )}
        >
          {feature.description}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export const Features: React.FC<FeaturesProps> = ({
  title,
  subtitle,
  description,
  features,
  columns = 3,
  variant = "default",
}) => {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <section className="relative py-16 sm:py-20 lg:py-24">
      {/* Section ambient blobs */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-100/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-56 w-56 translate-x-1/2 rounded-full bg-orange-100/25 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Section Header ── */}
        {(title || subtitle || description) && (
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className={cn(
              "mb-12 sm:mb-16",
              variant === "centered" ? "mx-auto max-w-3xl text-center" : "",
            )}
          >
            {subtitle && (
              <motion.div
                variants={headerItemVariants}
                className={cn(
                  "mb-4",
                  variant === "centered" ? "flex justify-center" : "",
                )}
              >
                <SectionLabel label={subtitle} color="orange" />
              </motion.div>
            )}
            {title && (
              <motion.h2
                variants={headerItemVariants}
                className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
              >
                {title}
              </motion.h2>
            )}
            {description && (
              <motion.p
                variants={headerItemVariants}
                className="text-base leading-relaxed text-slate-600 sm:text-lg"
              >
                {description}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* ── Features Grid ── */}
        <motion.div
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className={cn(
            "grid grid-cols-1",
            variant === "bento"
              ? "gap-4 sm:gap-5 md:grid-cols-3 md:auto-rows-[18rem]"
              : cn("gap-6 sm:gap-7", gridCols[columns]),
          )}
        >
          {features.map((feature, index) =>
            variant === "bento" ? (
              <BentoFeatureCard key={index} feature={feature} index={index} />
            ) : (
              <FeatureCard key={index} feature={feature} index={index} />
            ),
          )}
        </motion.div>
      </div>
    </section>
  );
};

// ─── Default icons (sized for badge) ─────────────────────────────────────────

export const FeatureIcons = {
  Calendar: <Calendar className="h-6 w-6" />,
  Location: <MapPin className="h-6 w-6" />,
  Users: <Users className="h-6 w-6" />,
  Shield: <ShieldCheck className="h-6 w-6" />,
  Lightning: <Zap className="h-6 w-6" />,
  CreditCard: <CreditCard className="h-6 w-6" />,
  Star: <Star className="h-6 w-6" />,
  Chart: <BarChart3 className="h-6 w-6" />,
};
