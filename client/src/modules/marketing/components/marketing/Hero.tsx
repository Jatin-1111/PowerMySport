"use client";

import { Button } from "@/modules/shared/ui/Button";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useRef } from "react";
import { SectionLabel } from "./SectionLabel";

export interface HeroProps {
  variant?: "home" | "page" | "split";
  title: string;
  /** Substring of `title` rendered with the gradient + underline treatment */
  titleHighlight?: string;
  subtitle?: string;
  description?: string;
  primaryCTA?: { label: string; href: string };
  secondaryCTA?: { label: string; href: string };
  imageSrc?: string;
  imageAlt?: string;
  gradient?: boolean;
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

const imageVariants: Variants = {
  hidden: { opacity: 0, x: 40, scale: 0.96 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 200, damping: 26, delay: 0.2 },
  },
};

// ─── HOME VARIANT ─────────────────────────────────────────────────────────────

const headlineVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
};

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 220, damping: 26 },
  },
};

const NOISE_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`;

function HomeHero({
  title,
  titleHighlight,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
  stats,
}: HeroProps) {
  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

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
        className="absolute inset-0 will-change-transform"
        style={{ y: imageY }}
        initial={{ scale: 1.14 }}
        animate={{ scale: 1.06 }}
        transition={{ duration: 7, ease: [0.22, 1, 0.36, 1] }}
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
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/98 via-slate-950/80 to-slate-950/50 sm:from-slate-950/95 sm:via-slate-950/55 sm:to-slate-950/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/55 sm:from-slate-950/85 sm:via-slate-950/10 sm:to-slate-950/40" />
      <div className="absolute inset-0 bg-[radial-gradient(110%_110%_at_50%_20%,transparent_45%,rgba(2,6,23,0.6)_100%)]" />

      {/* ── Film-grain texture ── */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: NOISE_TEXTURE }}
      />

      {/* ── Aurora glows (toned down on mobile) ── */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-power-orange/30 blur-[100px] sm:-bottom-24 sm:-left-24 sm:h-[28rem] sm:w-[28rem] sm:blur-[130px]"
        animate={{ x: [0, 50, 0], y: [0, -30, 0], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-[-4rem] h-48 w-48 rounded-full bg-sky-400/15 blur-[100px] sm:-top-32 sm:right-[-8rem] sm:h-[26rem] sm:w-[26rem] sm:blur-[130px]"
        animate={{ x: [0, -40, 0], y: [0, 30, 0], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        style={{ opacity: contentOpacity }}
        className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32"
      >
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
              className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-200 backdrop-blur-md sm:mb-6 sm:gap-2 sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.2em]"
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
                  <motion.span
                    key={i}
                    variants={wordVariants}
                    className="mr-[0.22em] inline-block"
                  >
                    {w.text}
                  </motion.span>
                );
              }
              if (i !== hlStart) return null;
              return (
                <span
                  key="hl"
                  className="relative mr-[0.22em] inline-block whitespace-nowrap"
                >
                  {hlWords.map((hw, j) => (
                    <motion.span
                      key={j}
                      variants={wordVariants}
                      className={`inline-block bg-gradient-to-r from-orange-300 via-power-orange to-amber-400 bg-clip-text text-transparent ${
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
                      transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
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

          {/* ── CTAs ── */}
          <motion.div
            variants={itemVariants}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4"
          >
            {primaryCTA && (
              <Link href={primaryCTA.href} className="w-full sm:w-auto">
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Button
                    variant="primary"
                    size="lg"
                    className="group relative h-auto w-full overflow-hidden rounded-2xl px-7 py-3.5 text-sm font-bold shadow-[0_10px_40px_-10px_rgba(233,115,22,0.7)] transition-shadow hover:shadow-[0_16px_48px_-10px_rgba(233,115,22,0.85)] sm:px-8 sm:py-4 sm:text-base"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {primaryCTA.label}
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                    <span
                      aria-hidden
                      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                    />
                  </Button>
                </motion.div>
              </Link>
            )}
            {secondaryCTA && (
              <Link href={secondaryCTA.href} className="w-full sm:w-auto">
                <motion.div
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto w-full rounded-2xl border-white/25 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:border-white/50 hover:bg-white/20 hover:text-white sm:px-8 sm:py-4 sm:text-base"
                  >
                    {secondaryCTA.label}
                  </Button>
                </motion.div>
              </Link>
            )}
          </motion.div>

          {/* ── Stats ── */}
          {stats && stats.length > 0 && (
            <motion.div
              variants={itemVariants}
              className="mt-8 grid w-full gap-2.5 grid-cols-2 sm:mt-10 sm:gap-3 sm:grid-cols-3"
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 backdrop-blur-md sm:rounded-2xl sm:px-4 sm:py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-300 sm:text-xs">
                    {stat.label}
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-white sm:mt-1 sm:text-2xl">
                    {stat.value}
                  </p>
                  {stat.helper && (
                    <p className="mt-0.5 text-[10px] text-slate-300 sm:text-xs">
                      {stat.helper}
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* ── Scroll cue (desktop only) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 sm:block"
      >
        <div className="flex h-10 w-6 justify-center rounded-full border-2 border-white/25 pt-1.5">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-white/90"
            animate={{ y: [0, 14, 0], opacity: [0.9, 0.2, 0.9] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>

    </section>
  );
}

// ─── PAGE VARIANT ─────────────────────────────────────────────────────────────

function PageHero({
  title,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden py-20 sm:py-24">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center"
        >
          {subtitle && (
            <motion.div
              variants={itemVariants}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label={subtitle} color="slate" />
            </motion.div>
          )}
          <motion.h1
            variants={itemVariants}
            className="font-title mb-5 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-5xl xl:text-6xl"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              variants={itemVariants}
              className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl"
            >
              {description}
            </motion.p>
          )}
          {(primaryCTA || secondaryCTA) && (
            <motion.div
              variants={itemVariants}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
            >
              {primaryCTA && (
                <Link href={primaryCTA.href}>
                  <Button variant="primary" size="lg" className="rounded-xl">
                    {primaryCTA.label}
                  </Button>
                </Link>
              )}
              {secondaryCTA && (
                <Link href={secondaryCTA.href}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-xl bg-white"
                  >
                    {secondaryCTA.label}
                  </Button>
                </Link>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ─── SPLIT VARIANT ────────────────────────────────────────────────────────────

function SplitHero({
  title,
  subtitle,
  description,
  primaryCTA,
  secondaryCTA,
  imageSrc,
  imageAlt,
}: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-ghost-white py-20 sm:py-24 lg:py-28">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-200/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-amber-200/20 blur-[100px]" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          {subtitle && (
            <motion.div variants={itemVariants} className="mb-5">
              <SectionLabel label={subtitle} color="orange" />
            </motion.div>
          )}
          <motion.h1
            variants={itemVariants}
            className="font-title mb-6 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl lg:text-5xl xl:text-6xl"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              variants={itemVariants}
              className="mb-8 text-lg leading-relaxed text-slate-600"
            >
              {description}
            </motion.p>
          )}
          <motion.div
            variants={itemVariants}
            className="flex flex-col gap-3 sm:flex-row sm:gap-4"
          >
            {primaryCTA && (
              <Link href={primaryCTA.href}>
                <Button variant="primary" size="lg" className="rounded-xl">
                  {primaryCTA.label}
                </Button>
              </Link>
            )}
            {secondaryCTA && (
              <Link href={secondaryCTA.href}>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-xl bg-white"
                >
                  {secondaryCTA.label}
                </Button>
              </Link>
            )}
          </motion.div>
        </motion.div>

        {imageSrc && (
          <motion.div
            variants={imageVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="relative h-[280px] w-full sm:h-[380px] lg:h-[460px]"
          >
            {/* Decorative glow */}
            <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-orange-400/15 via-transparent to-turf-green/10 blur-2xl" />
            <div
              className="relative h-full w-full overflow-hidden rounded-3xl"
              style={{
                clipPath:
                  "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)",
              }}
            >
              <Image
                src={imageSrc}
                alt={imageAlt || title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/8 rounded-3xl" />
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const Hero: React.FC<HeroProps> = (props) => {
  if (props.variant === "home") return <HomeHero {...props} />;
  if (props.variant === "split") return <SplitHero {...props} />;
  return <PageHero {...props} />;
};
