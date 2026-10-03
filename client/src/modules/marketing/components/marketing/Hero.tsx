"use client";

import { Button } from "@/modules/shared/ui/Button";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useRef } from "react";

export interface HeroProps {
  title: string;
  /** Substring of `title` rendered with the gradient + underline treatment */
  titleHighlight?: string;
  subtitle?: string;
  description?: string;
  /** Short question shown above the CTA row — use to frame two CTAs as a self-segmenting fork */
  ctaPrompt?: string;
  primaryCTA?: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
  stats?: Array<{ label: string; value: string; helper?: string }>;
}

// ─── Motion Variants ──────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.13, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 22 },
  },
};

// ─── HOME VARIANT ─────────────────────────────────────────────────────────────

const headlineVariants: Variants = itemVariants;

const wordVariants: Variants = {
  hidden: {},
  show: {},
};

const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;

function HomeHero({
  title,
  titleHighlight,
  subtitle,
  description,
  ctaPrompt,
  primaryCTA,
  secondaryCTA,
  stats,
}: HeroProps) {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);

  // Split the title into words, tagging the highlighted phrase
  const words: Array<{ text: string; hl: boolean }> = [];
  if (titleHighlight && title.includes(titleHighlight)) {
    const [before, ...rest] = title.split(titleHighlight);
    before
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => words.push({ text: w, hl: false }));
    titleHighlight
      .trim()
      .split(/\s+/)
      .forEach((w) => words.push({ text: w, hl: true }));
    rest
      .join(titleHighlight)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => words.push({ text: w, hl: false }));
  } else {
    title
      .trim()
      .split(/\s+/)
      .forEach((w) => words.push({ text: w, hl: false }));
  }
  const hlStart = words.findIndex((w) => w.hl);
  const hlWords = words.filter((w) => w.hl);

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-[85vh] items-center overflow-hidden bg-slate-950 sm:min-h-[88vh] lg:min-h-[92vh]"
    >
      {/* ── Full-bleed background image ── */}
      <motion.div
        className="absolute inset-0 scale-105 will-change-transform"
        style={{ y: imageY }}
      >
        <Image
          src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?fm=jpg&q=75&w=2400&auto=format&fit=crop"
          alt="Young footballer chasing the ball across a grass pitch"
          fill
          priority
          sizes="100vw"
          // On mobile: shift focal point up so the subject shows above the text
          className="object-cover object-[55%_25%] sm:object-[62%_center]"
        />
      </motion.div>

      {/* ── Scrims — heavier on mobile where text covers the full width ── */}
      <div className="from-slate-950/98 absolute inset-0 bg-gradient-to-r via-slate-950/80 to-slate-950/50 sm:from-slate-950/95 sm:via-slate-950/55 sm:to-slate-950/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/55 sm:from-slate-950/85 sm:via-slate-950/10 sm:to-slate-950/40" />
      <div className="absolute inset-0 bg-[radial-gradient(110%_110%_at_50%_20%,transparent_45%,rgba(2,6,23,0.6)_100%)]" />

      {/* ── Film-grain texture ── */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: NOISE_TEXTURE }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex max-w-3xl flex-col items-start"
        >
          {/* ── Eyebrow pill ── */}
          {subtitle && (
            <motion.div
              variants={itemVariants}
              className="mb-4 inline-flex items-center gap-1.5 rounded-sm border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200 sm:mb-6 sm:gap-2 sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.2em]"
            >
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {subtitle}
            </motion.div>
          )}

          {/* ── Headline ── */}
          <motion.h1
            variants={headlineVariants}
            className="font-title mb-4 text-[2.1rem] font-extrabold leading-[1.08] tracking-tight text-white sm:mb-6 sm:text-5xl lg:text-[4.5rem]"
          >
            {words.map((w, i) => {
              if (!w.hl) {
                return (
                  <motion.span key={i} variants={wordVariants} className="mr-[0.22em] inline-block">
                    {w.text}
                  </motion.span>
                );
              }
              if (i !== hlStart) return null;
              return (
                <span key="hl" className="relative mr-[0.22em] inline-block whitespace-nowrap">
                  {hlWords.map((hw, j) => (
                    <motion.span
                      key={j}
                      variants={wordVariants}
                      className={`via-power-orange inline-block bg-gradient-to-r from-orange-300 to-amber-400 bg-clip-text text-transparent ${
                        j < hlWords.length - 1 ? "mr-[0.22em]" : ""
                      }`}
                    >
                      {hw.text}
                    </motion.span>
                  ))}
                  <svg
                    className="absolute -bottom-1.5 left-0 h-2.5 w-full sm:-bottom-2.5 sm:h-3"
                    viewBox="0 0 220 12"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <motion.path
                      d="M4 9 C 60 2, 160 2, 216 7"
                      fill="none"
                      stroke="url(#hero-underline)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.35, duration: 0.6, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="hero-underline" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#fb923c" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
              );
            })}
          </motion.h1>

          {/* ── Description ── */}
          {description && (
            <motion.p
              variants={itemVariants}
              className="mb-8 max-w-lg text-sm leading-relaxed text-slate-200/90 sm:mb-10 sm:text-base sm:text-slate-200/95 lg:max-w-xl lg:text-lg"
            >
              {description}
            </motion.p>
          )}

          {/* ── CTA prompt ── */}
          {ctaPrompt && (
            <motion.p
              variants={itemVariants}
              className="mb-3 text-sm font-semibold text-white/90 sm:text-base"
            >
              {ctaPrompt}
            </motion.p>
          )}

          {/* ── CTAs ── */}
          <motion.div
            variants={itemVariants}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4"
          >
            {/* Plain colour-and-press buttons (`btn-motion`, via Button). The
                spring lift, shine sweep and growing orange glow these had were
                three effects competing on one click target. `asChild` makes the
                link itself the button, so keyboard users get one tab stop. */}
            {primaryCTA && (
              <Button
                asChild
                variant="primary"
                size="lg"
                className="group h-auto w-full px-7 py-3.5 text-sm font-bold focus-visible:ring-offset-slate-950 sm:w-auto sm:px-8 sm:py-4 sm:text-base"
              >
                <Link href={primaryCTA.href}>
                  {primaryCTA.label}
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </Button>
            )}
            {secondaryCTA && (
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-auto w-full border-white/25 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white hover:border-white/50 hover:bg-white/20 focus-visible:ring-white focus-visible:ring-offset-slate-950 sm:w-auto sm:px-8 sm:py-4 sm:text-base"
              >
                <Link href={secondaryCTA.href}>{secondaryCTA.label}</Link>
              </Button>
            )}
          </motion.div>

          {/* ── Stats ── */}
          {stats && stats.length > 0 && (
            <motion.div
              variants={itemVariants}
              className="mt-8 grid w-full grid-cols-2 gap-2.5 sm:mt-10 sm:grid-cols-3 sm:gap-3"
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-white/15 bg-white/10 px-3.5 py-2.5 sm:px-4 sm:py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300 sm:text-xs">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-white sm:mt-1 sm:text-2xl">
                    {stat.value}
                  </p>
                  {stat.helper && (
                    <p className="mt-0.5 text-[10px] text-slate-300 sm:text-xs">{stat.helper}</p>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

// The homepage is the only page with a photo hero; every other page uses the
// shared `PageHeader` (modules/shared/ui). The "page" and "split" variants that
// used to live here gave the site five header styles between them.
export const Hero: React.FC<HeroProps> = (props) => <HomeHero {...props} />;
