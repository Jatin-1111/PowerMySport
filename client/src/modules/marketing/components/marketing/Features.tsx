"use client";

import { cn } from "@/utils/cn";
import {
  motion,
  Variants,
} from "framer-motion";
import {
  BarChart3,
  Calendar,
  CreditCard,
  MapPin,
  ShieldCheck,
  Star,
  Users,
  Zap,
  LucideIcon,
} from "lucide-react";
import React from "react";
import { SectionLabel } from "./SectionLabel";

export interface Feature {
  title: string;
  description: string;
  icon?: React.ReactNode;
  label?: string;
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

function FeatureCard({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
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
      <h3 className="mb-2.5 text-lg font-bold text-slate-900">{feature.title}</h3>
      <p className="text-sm leading-relaxed text-slate-600">{feature.description}</p>

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

const bentoSpans = [
  "md:col-span-2 md:row-span-2",
  "",
  "",
  "md:col-span-2",
  "",
  "",
];

function BentoFeatureCard({
  feature,
  index,
}: {
  feature: Feature;
  index: number;
}) {
  const colorClass = iconBgColors[index % iconBgColors.length];
  const span = bentoSpans[index % bentoSpans.length];
  const isHero = span.includes("row-span-2");

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur-md will-change-transform premium-shadow hover:border-white/90 hover:bg-white/90",
        span,
      )}
    >
      {/* Ambient gradient header block, taller for the hero tile */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-br opacity-[0.15]",
          isHero ? "h-2/3" : "h-1/2",
          index % 2 === 0
            ? "from-power-orange to-transparent"
            : "from-turf-green to-transparent",
        )}
      />

      <div className="relative">
        {feature.icon && (
          <motion.div
            className={cn(
              "mb-5 flex shrink-0 items-center justify-center rounded-xl will-change-transform",
              isHero ? "h-14 w-14" : "h-12 w-12",
              colorClass,
            )}
            whileHover={{ rotate: 8, scale: 1.15 }}
            transition={{ type: "spring", stiffness: 300, damping: 16 }}
          >
            {feature.icon}
          </motion.div>
        )}
        {feature.label && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            {feature.label}
          </p>
        )}
        <h3
          className={cn(
            "mb-2.5 font-bold text-slate-900",
            isHero ? "text-2xl" : "text-lg",
          )}
        >
          {feature.title}
        </h3>
        <p
          className={cn(
            "leading-relaxed text-slate-600",
            isHero ? "text-base" : "text-sm",
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
              <motion.div variants={headerItemVariants} className={cn("mb-4", variant === "centered" ? "flex justify-center" : "")}>
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
            "grid grid-cols-1 gap-5 sm:gap-6",
            variant === "bento" ? "md:grid-cols-3 md:auto-rows-[14rem]" : gridCols[columns],
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
